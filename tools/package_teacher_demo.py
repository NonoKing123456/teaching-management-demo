"""Make the built fictional demo portable to single-file static hosts."""
import base64
import argparse
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dist', type=Path, default=root / 'demo/teacher-preview/dist')
parser.add_argument('--output', type=Path, default=root / '.run/domestic-demo')
args = parser.parse_args()
dist = args.dist.resolve()
target = args.output.resolve()
target.mkdir(parents=True, exist_ok=True)
html = (dist / 'index.html').read_text(encoding='utf-8')
script = re.search(r'<script[^>]+src="([^"]+)"[^>]*></script>', html)
stylesheet = re.search(r'<link[^>]+href="([^"]+)"[^>]*>', html)
if not script or not stylesheet:
    raise SystemExit('Build the Vue demo before packaging.')
js = (dist / script[1].lstrip('/')).read_text(encoding='utf-8')
css = (dist / stylesheet[1].lstrip('/')).read_text(encoding='utf-8')
files = {f.name: base64.b64encode(f.read_bytes()).decode('ascii')
         for f in sorted((dist / 'examples').glob('*.xlsx'))}
if len(files) != 10:
    raise SystemExit('Expected templates and samples for all five upload modules.')
bootstrap = '''
// Demo examples are embedded: no CDN, external API, or extra file server.
const demoFiles = DEMO_FILES;
const nativeFetch = window.fetch.bind(window);
window.fetch = async function(input, init) {
  const address = input instanceof Request ? input.url : String(input);
  const path = new URL(address, location.href).pathname;
  if (path.startsWith('/examples/')) {
    const value = demoFiles[path.slice('/examples/'.length)];
    if (!value) return new Response('Example not found', {status: 404});
    const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    return new Response(bytes, {headers: {'Content-Type':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
  }
  return nativeFetch(input, init);
};
'''.replace('DEMO_FILES', json.dumps(files, separators=(',', ':')))
html = html.replace(script[0], '<script>' + bootstrap + '</script>')
html = html.replace(stylesheet[0], '<style>' + css + '</style>')
html = html.replace('</body>', '<script type="module">' +
                    js.replace('</script', '<\\/script') + '</script></body>')
(target / 'index.html').write_text(html, encoding='utf-8', newline='\n')
with ZipFile(target / 'teacher-demo-static.zip', 'w', ZIP_DEFLATED) as archive:
    archive.write(target / 'index.html', 'index.html')
record = {'file': str(target / 'index.html'), 'bytes': len(html.encode()),
          'sha256': hashlib.sha256(html.encode()).hexdigest(),
          'embedded_excel_files': len(files)}
(target / 'package.json').write_text(json.dumps(record, indent=2)+'\n', encoding='utf-8')
print(json.dumps(record))
