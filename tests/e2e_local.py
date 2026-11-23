import asyncio, os, shutil, subprocess, sys
from playwright.async_api import async_playwright

BASE = os.environ.get('RP_BASE', 'http://localhost:8765/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out') + os.sep
CHROME = os.environ.get('CHROME_PATH') or shutil.which('google-chrome') or None
os.makedirs(OUT, exist_ok=True)
SAMPLE = OUT + 'sample.mp4'
if not os.path.exists(SAMPLE):
    # 12 s, 4:5 test video (needs ffmpeg)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1350:rate=30:duration=12',
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', SAMPLE], check=True)

async def main():
    errors = []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1360, 'height': 900})
        await ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/'))
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        pg.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' and 'fonts.g' not in m.text else None)

        await pg.goto(BASE)
        await pg.wait_for_selector('.demo-user')
        await pg.screenshot(path=OUT + '01-signin.png')

        # Sign in as admin, create review
        await pg.click('.demo-user[data-email="admin@end.local"]')
        await pg.wait_for_selector('#new-review')
        await pg.click('#new-review')
        await pg.fill('#nr-name', 'Magnolia — brochure 60s')
        await pg.fill('#nr-project', 'Magnolia')
        await pg.set_input_files('#nr-file', SAMPLE)
        await pg.click('#nr-submit')
        await pg.wait_for_selector('#vid')
        await pg.wait_for_function("document.querySelector('#vid').readyState >= 1 && document.querySelector('#vid').videoWidth > 0", timeout=15000)

        # Seek to ~3.2s, click on the frame at 40% / 25%
        await pg.evaluate("document.querySelector('#vid').currentTime = 3.2")
        await pg.wait_for_timeout(400)
        box = await pg.locator('#stage').bounding_box()
        # content rect: stage aspect ratio equals video aspect after metadata, so the frame fills the stage
        await pg.mouse.click(box['x'] + box['width'] * 0.40, box['y'] + box['height'] * 0.25)
        await pg.wait_for_selector('#composer:not([hidden])')
        label = await pg.text_content('#composer-label')
        await pg.fill('#composer-text', 'Ndrysho çmimin këtu: duhet AED 1.2M')
        await pg.click('#composer-save')
        await pg.wait_for_selector('.comment')

        # Second comment at 8s
        await pg.evaluate("document.querySelector('#vid').currentTime = 8.0")
        await pg.wait_for_timeout(300)
        box = await pg.locator('#stage').bounding_box()
        await pg.mouse.click(box['x'] + box['width'] * 0.8, box['y'] + box['height'] * 0.1)
        await pg.fill('#composer-text', 'Logoja më e madhe')
        await pg.click('#composer-save')
        await pg.wait_for_function("document.querySelectorAll('.comment').length === 2")
        await pg.screenshot(path=OUT + '02-review-admin.png')

        # Click first comment -> seeks to its time and shows its pin
        await pg.click('.comment >> nth=0')
        await pg.wait_for_timeout(500)
        t = await pg.evaluate("document.querySelector('#vid').currentTime")
        pins = await pg.locator('.pin[data-id]').count()
        markers = await pg.locator('.tl-marker').count()

        # Sign in as Dion (decider) and add a comment, resolve one, then close
        await pg.click('#signout')
        if await pg.locator('#staff').count():  # on a review link, signed-out users first see the guest screen
            await pg.click('#staff')
        await pg.click('.demo-user[data-email="dion@end.local"]')
        await pg.wait_for_selector('#vid')
        await pg.wait_for_function("document.querySelector('#vid') && document.querySelector('#vid').videoWidth > 0", timeout=15000)
        await pg.evaluate("document.querySelector('#vid').currentTime = 5.5")
        await pg.wait_for_timeout(300)
        box = await pg.locator('#stage').bounding_box()
        await pg.mouse.click(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.6)
        await pg.fill('#composer-text', 'Kjo skenë më e shkurtër')
        await pg.click('#composer-save')
        await pg.wait_for_function("document.querySelectorAll('.comment').length === 3")
        await pg.click('.comment >> nth=0 >> [data-act=resolve]')
        await pg.wait_for_selector('.comment.is-resolved')
        await pg.screenshot(path=OUT + '03-review-dion.png')

        await pg.click('#a-close')
        await pg.click('.modal .btn-primary')
        await pg.wait_for_selector('.pill-closed')
        closed_hint = await pg.text_content('#hint')
        # clicking on frame when closed must not open composer
        await pg.mouse.click(box['x'] + box['width'] * 0.3, box['y'] + box['height'] * 0.3)
        await pg.wait_for_timeout(300)
        composer_hidden = await pg.locator('#composer').is_hidden()

        # Send to Claude: copies the export (plus instructions and saved rules) and opens claude.ai in a new tab
        async with ctx.expect_page() as claude_tab:
            await pg.click('#a-claude')
        await (await claude_tab.value).close()
        exp = await pg.evaluate('navigator.clipboard.readText()')

        # Reload persists
        await pg.reload()
        await pg.wait_for_selector('.comment')
        persisted = await pg.locator('.comment').count()

        # Phone layout
        await pg.set_viewport_size({'width': 390, 'height': 844})
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + '05-phone.png', full_page=True)

        # English
        await pg.click('#lang')
        await pg.wait_for_timeout(300)
        en_title = await pg.text_content('.comments-head h2')

        print('composer label:', label)
        print('seek after click comment:', round(t, 2), 'pins:', pins, 'markers:', markers)
        print('positions in export should be ~40/25, ~80/10, ~50/60');print('closed hint:', closed_hint, '| composer hidden when closed:', composer_hidden)
        print('persisted comments after reload:', persisted)
        print('lang toggle ->', en_title)
        print('--- export ---\n' + exp)
        print('--- errors ---\n' + '\n'.join(errors) if errors else '--- no errors ---')
        await b.close()

asyncio.run(main())
