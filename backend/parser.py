from pathlib import Path
import zipfile
from xml.etree import ElementTree

def read_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as e:
            raise RuntimeError("pypdf is required to parse PDFs. pip install pypdf") from e
        reader = PdfReader(str(path))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    if suffix == ".docx":
        with zipfile.ZipFile(path) as archive:
            xml = archive.read("word/document.xml")
        root = ElementTree.fromstring(xml)
        namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        text_nodes = [node.text for node in root.findall(".//w:t", namespace) if node.text]
        return "\n".join(text_nodes)
    return path.read_text(encoding="utf-8", errors="ignore")
