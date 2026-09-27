"""Build a single, offline HTML file. Python standard library only."""
from pathlib import Path
import base64

ROOT = Path(__file__).resolve().parent

def main():
    font_rules = []
    for name, filename in [('DM Sans', 'dm-sans.ttf'), ('Space Grotesk', 'space-grotesk.ttf')]:
        encoded = base64.b64encode((ROOT / 'vendor' / filename).read_bytes()).decode('ascii')
        font_rules.append(f"@font-face{{font-family:'{name}';font-style:normal;font-weight:400 700;font-display:swap;src:url(data:font/ttf;base64,{encoded}) format('truetype')}}")
    css = (ROOT / 'src/style.css').read_text(encoding='utf-8').replace('/* INLINE_FONTS */', '\n'.join(font_rules))
    parts = {
        'CSS': css,
        'THREE': (ROOT / 'vendor/three.min.js').read_text(encoding='utf-8'),
        'BATCH': (ROOT / 'src/batch.js').read_text(encoding='utf-8'),
        'COASTER': (ROOT / 'src/coaster.js').read_text(encoding='utf-8'),
        'FERRIS': (ROOT / 'src/ferris.js').read_text(encoding='utf-8'),
        'MAIN': (ROOT / 'src/main.js').read_text(encoding='utf-8'),
    }
    html = (ROOT / 'src/index.template.html').read_text(encoding='utf-8')
    for key, value in parts.items():
        if key != 'CSS':
            value = value.replace('</script', '<\\/script')
        html = html.replace(f'/* INLINE_{key} */', value)
    licenses = '\n\n'.join((ROOT / 'vendor' / name).read_text(encoding='utf-8') for name in ['THREE-LICENSE.txt', 'DM-SANS-LICENSE.txt', 'SPACE-GROTESK-LICENSE.txt'])
    html = html.replace('<head>', '<head>\n<!-- Bundled third-party licenses:\n' + licenses.replace('--', '—') + '\n-->')
    (ROOT / 'index.html').write_bytes(html.encode('utf-8'))
    print(f'Built index.html ({len(html.encode("utf-8")) / 1024:.0f} KB), with no runtime network dependencies.')

if __name__ == '__main__':
    main()
