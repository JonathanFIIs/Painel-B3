from app import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_api():
    print("Testing /api/noticias...")
    res = client.get("/api/noticias?agencia=18")
    assert res.status_code == 200
    data = res.json()
    total = data.get("total", 0)
    items = data.get("items", [])
    print(f"OK! Received {total} items.")
    
    if items:
        first = items[0]
        print(f"First item: ID={first['id']}, Ticker={first['ticker']}, Headline={first['headline']}")
        print(f"Testing /api/documento/{first['id']}...")
        doc_res = client.get(f"/api/documento/{first['id']}?agencia=18&data_noticia={first['dateTime']}")
        assert doc_res.status_code == 200
        doc_data = doc_res.json()
        print("OK! Doc data:")
        print("  Document ID:", doc_data.get("documentId"))
        print("  Viewer URL:", doc_data.get("viewerUrl"))
        print("  Download URL:", doc_data.get("downloadUrl"))
        
        if doc_data.get("documentId"):
            proxy_res = client.get(f"/api/proxy-document/{doc_data.get('documentId')}")
            print(f"OK! Proxy document status: {proxy_res.status_code}")

    print("Testing Root / and Static mount...")
    root_res = client.get("/")
    assert root_res.status_code == 200
    print("OK! Root returns status 200 and length:", len(root_res.text))

if __name__ == "__main__":
    test_api()
