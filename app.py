import json
import re
import urllib.parse
import urllib.request
import datetime
from typing import Optional
from fastapi import FastAPI, Query, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
import uvicorn
import os

from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(title="B3 Plantão de Notícias - Monitor & Visualizador")

class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/static") or request.url.path == "/":
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheMiddleware)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}

def fetch_url(url: str, timeout: int = 25) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()

def parse_category(headline: str) -> str:
    h = headline.lower()
    
    # 1. Fatos Relevantes
    if "fato relevante" in h:
        return "Fato Relevante"
    
    # 2. Ofertas Públicas & Emissões (Prioridade antes de rendimentos/distribuição genérica)
    if any(k in h for k in [
        "distribuicao de cotas", "distribuição de cotas",
        "distribuicao publica", "distribuição pública",
        "distribuicao primaria", "distribuição primária",
        "distribuicao secundaria", "distribuição secundária",
        "distribuicao cotas", "distribuição cotas",
        "oferta publica", "oferta pública", "oferta de",
        "anuncio de inicio", "anúncio de início", "anuncio inicio", "anúncio início",
        "anuncio de encerramento", "anúncio de encerramento", "anuncio encerramento",
        "prospecto", "suplemento",
        "emissao de cotas", "emissão de cotas", "emissao de acoes", "emissão de ações",
        "emissao de debentures", "emissão de debêntures", "emissao de cri", "emissão de cra",
        "subscricao", "subscrição", "direito de preferencia", "direito de preferência",
        "sobras de subscricao", "sobras de subscrição", "rateio da oferta",
        "integralizacao", "integralização", "recibo de subscricao", "recibo de subscrição"
    ]):
        return "Ofertas & Emissões"

    # 3. Rendimentos & Proventos (Dividendos, JCP, Rendimentos de FIIs)
    if any(k in h for k in [
        "rendimento", "provento", "dividendo", "jcp", "juros sobre capital",
        "amortizacao", "amortização", "distribuicao de rendimento", "distribuição de rendimento",
        "distribuicao de provento", "distribuição de provento", "distribuicao mensal", "distribuição mensal"
    ]) and not any(k in h for k in ["informe de rendimento", "informe de rendimentos"]):
        return "Rendimentos"

    # 4. Assembleias (AGE, AGO, Consultas Formais)
    if any(k in h for k in [
        "assembleia", "age", "ago", "edital de convocacao", "edital de convocação",
        "convocacao de assembleia", "convocação de assembleia", "consulta formal",
        "proposta da administracao", "proposta da administração", "boletim de voto"
    ]):
        return "Assembleias"

    # 5. Atas & Governança Corporativa
    if any(k in h for k in [
        "ata reuniao", "ata da reuniao", "ata da assembleia",
        "conselho de administracao", "conselho fiscal", "comite", "comitê",
        "estatuto social", "regulamento", "regimento", "homologat", "governanca", "governança"
    ]):
        return "Atas & Governança"

    # 6. Avisos aos Cotistas / Acionistas / Debenturistas
    if any(k in h for k in [
        "aviso aos cotistas", "aviso aos acionistas", "aviso aos debenturistas",
        "aviso aos investidores", "aviso investidores"
    ]):
        return "Avisos"

    # 7. Comunicados ao Mercado
    if any(k in h for k in [
        "comunicado", "esclarecimento", "apresentacao", "apresentação",
        "aviso ao mercado", "informacao relevante", "informação relevante"
    ]):
        return "Comunicado ao Mercado"

    # 8. Relatórios Gerenciais
    if any(k in h for k in ["relat", "relatorio gerencial", "relatório gerencial", "relatorio de gestao", "relatório de gestão", "outros relatorios", "outros relatórios"]):
        return "Relatórios Gerenciais"

    # 9. Informes Periódicos (Mensal, Trimestral, Anual)
    if any(k in h for k in ["informe mensal", "informe trimestral", "informe anual", "informe estruturado", "informe periodico", "informe periódico", "informe"]):
        return "Informes Periódicos"

    # 10. Demonstrações Financeiras / Resultados
    if any(k in h for k in ["demonstra", "dfp", "itr", "balancete", "press-release", "dados financeiros", "resultado trimestral", "balanco", "balanço"]):
        return "Demonstrações Financeiras"

    # 11. Leilões & Negociação
    if any(k in h for k in [
        "leilao", "leilão", "call de", "after market", "oscilacao", "oscilação",
        "prorrogado", "alterado o horario", "negociacao", "negociação"
    ]):
        return "Leilões & Pregão"

    # 12. Dados Diários
    if any(k in h for k in ["dados diarios", "dados diários"]):
        return "Dados Diários"

    return "Outros"

def extract_ticker_info(headline: str):
    if not headline:
        return None
    # 1. Search for standard tickers (e.g. HGLG11, MXRF11, PETR4, VALE3, BBDC4, KNIP11)
    full_match = re.search(r'\b([A-Z]{4}(?:11|12|13|14|3|4|5|6|34|35|39))\b', headline)
    if full_match:
        return full_match.group(1)
        
    # 2. Search for ticker in parentheses (e.g. (HGBS), (HGLG), (PETR4), (VALE3))
    paren_match = re.search(r'\(([A-Z0-9]{4,6})\)', headline)
    if paren_match:
        code = paren_match.group(1)
        # If it is a 4-letter code in a FII/FIAGRO headline, standard trading ticker is code + '11'
        if len(code) == 4 and any(w in headline.upper() for w in ["FII ", "FIAGRO", "FDO INV", "IMOB"]):
            return code + "11"
        return code
        
    # 3. Match at beginning of headline (e.g. 'PETR4 - ', 'HGLG11 - ')
    start_match = re.search(r'^([A-Z0-9]{4,6})\b', headline)
    if start_match:
        return start_match.group(1)
        
    return None

def is_fii_item(headline: str, ticker: Optional[str]) -> bool:
    h_upper = headline.upper()
    if h_upper.startswith("FII ") or " FII " in h_upper or "(FII)" in h_upper or "FII/" in h_upper or "FII-" in h_upper:
        return True
    if "IMOBILIÁRIO" in h_upper or "IMOBILIARIO" in h_upper or "FDO INV IMOB" in h_upper or "FDO INV IM" in h_upper:
        return True
    if ticker and (ticker.endswith("11") or re.match(r'^[A-Z0-9]{4}11$', ticker)):
        return True
    return False

def fetch_agency_data(agencia_code: str, periodo: str, palavra: str = "", dataInicial: str = None, dataFinal: str = None):
    today = datetime.date.today()
    if periodo in ("hoje", "today"):
        d_ini = today.strftime("%Y-%m-%d")
        d_fim = today.strftime("%Y-%m-%d")
        url = f"https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/ListarTitulosNoticias?agencia={agencia_code}&palavra={urllib.parse.quote(palavra or '')}&dataInicial={d_ini}&dataFinal={d_fim}"
    elif periodo in ("semana", "esta_semana", "esta semana"):
        days_from_sunday = (today.weekday() + 1) % 7
        d_ini = (today - datetime.timedelta(days=days_from_sunday)).strftime("%Y-%m-%d")
        d_fim = today.strftime("%Y-%m-%d")
        url = f"https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/ListarTitulosNoticias?agencia={agencia_code}&palavra={urllib.parse.quote(palavra or '')}&dataInicial={d_ini}&dataFinal={d_fim}"
    elif periodo in ("mes", "este_mes", "este mes", "este mês"):
        d_ini = today.replace(day=1).strftime("%Y-%m-%d")
        d_fim = today.strftime("%Y-%m-%d")
        url = f"https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/ListarTitulosNoticias?agencia={agencia_code}&palavra={urllib.parse.quote(palavra or '')}&dataInicial={d_ini}&dataFinal={d_fim}"
    elif periodo in ("todos", "all"):
        d_ini = (today - datetime.timedelta(days=90)).strftime("%Y-%m-%d")
        d_fim = today.strftime("%Y-%m-%d")
        url = f"https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/ListarTitulosNoticias?agencia={agencia_code}&palavra={urllib.parse.quote(palavra or '')}&dataInicial={d_ini}&dataFinal={d_fim}"
    elif periodo == "ultimos30":
        d_ini = (today - datetime.timedelta(days=30)).strftime("%Y-%m-%d")
        d_fim = today.strftime("%Y-%m-%d")
        url = f"https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/ListarTitulosNoticias?agencia={agencia_code}&palavra={urllib.parse.quote(palavra or '')}&dataInicial={d_ini}&dataFinal={d_fim}"
    elif periodo == "ultimos7":
        d_ini = (today - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
        d_fim = today.strftime("%Y-%m-%d")
        url = f"https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/ListarTitulosNoticias?agencia={agencia_code}&palavra={urllib.parse.quote(palavra or '')}&dataInicial={d_ini}&dataFinal={d_fim}"
    elif periodo == "custom" and dataInicial and dataFinal:
        url = f"https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/ListarTitulosNoticias?agencia={agencia_code}&palavra={urllib.parse.quote(palavra or '')}&dataInicial={dataInicial}&dataFinal={dataFinal}"
    else:
        d_ini = today.replace(day=1).strftime("%Y-%m-%d")
        d_fim = today.strftime("%Y-%m-%d")
        url = f"https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/ListarTitulosNoticias?agencia={agencia_code}&palavra={urllib.parse.quote(palavra or '')}&dataInicial={d_ini}&dataFinal={d_fim}"

    raw_data = fetch_url(url, timeout=25)
    text_data = raw_data.decode("utf-8", errors="ignore")
    if text_data == "null" or not text_data.strip():
        return []
    items_raw = json.loads(text_data)
    if not isinstance(items_raw, list):
        return []
    
    results = []
    for item in items_raw:
        msg = item.get("NwsMsg", {})
        headline = msg.get("headline", "")
        ticker = extract_ticker_info(headline)
        results.append({
            "id": msg.get("id"),
            "idAgencia": msg.get("IdAgencia", int(agencia_code) if agencia_code.isdigit() else 18),
            "dateTime": msg.get("dateTime"),
            "headline": headline,
            "ticker": ticker,
            "category": parse_category(headline),
            "isFii": is_fii_item(headline, ticker)
        })
    return results

@app.get("/api/noticias")
def get_noticias(
    agencia: str = "fii_only",  # "fii_only", "acoes", "all", "monitored", "18", "17"
    periodo: str = "mes",      # "mes", "ultimos30", "ultimos7", "hoje", "custom"
    palavra: Optional[str] = None,
    dataInicial: Optional[str] = None,
    dataFinal: Optional[str] = None
):
    try:
        if agencia == "all" or agencia == "monitored":
            results = fetch_agency_data("18", periodo, palavra or "", dataInicial, dataFinal)
        elif agencia == "fii_only":
            raw18 = fetch_agency_data("18", periodo, palavra or "", dataInicial, dataFinal)
            results = [item for item in raw18 if item.get("isFii")]
        elif agencia == "acoes":
            raw18 = fetch_agency_data("18", periodo, palavra or "", dataInicial, dataFinal)
            results = [item for item in raw18 if not item.get("isFii")]
        else:
            code = "17" if agencia == "17" else "18"
            results = fetch_agency_data(code, periodo, palavra or "", dataInicial, dataFinal)

        return {
            "items": results,
            "total": len(results),
            "agencia": agencia,
            "periodo": periodo
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar comunicados da B3: {str(e)}")

@app.get("/api/documento/{id_noticia}")
def get_documento_detalhes(id_noticia: int, agencia: str = "18", data_noticia: Optional[str] = None):
    try:
        agency_param = "17" if agencia == "17" else "18"
        encoded_date = urllib.parse.quote(data_noticia or "")
        url = f"https://sistemasweb.b3.com.br/PlantaoNoticias/Noticias/Detail?idNoticia={id_noticia}&agencia={agency_param}&dataNoticia={encoded_date}"
        
        raw_html = fetch_url(url, timeout=15).decode("utf-8", errors="ignore")
        
        content_match = re.search(r'<pre id="conteudoDetalhe"[^>]*>(.*?)</pre>', raw_html, re.DOTALL | re.IGNORECASE)
        content_text = content_match.group(1).strip() if content_match else ""
        
        urls = re.findall(r'(https?://[^\s<>"\']+)', content_text)
        
        doc_id = None
        main_doc_url = None
        
        for u in urls:
            cleaned_u = u.replace("&amp;", "&").replace("?flnk", "").replace("&flnk", "")
            id_m = re.search(r'[?&]id=(\d+)', cleaned_u)
            if id_m:
                doc_id = id_m.group(1)
                main_doc_url = cleaned_u
                break
            elif "fnet.bmfbovespa.com.br" in cleaned_u or "cvm.gov.br" in cleaned_u:
                main_doc_url = cleaned_u
        
        title_match = re.search(r'<h4>(.*?)</h4>', raw_html, re.DOTALL | re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else ""

        has_document = bool(doc_id or main_doc_url)
        
        if doc_id:
            viewer_url = f"/api/proxy-document/{doc_id}"
            download_url = f"https://fnet.bmfbovespa.com.br/fnet/publico/downloadDocumento?id={doc_id}"
            fnet_viewer_url = f"https://fnet.bmfbovespa.com.br/fnet/publico/visualizarDocumento?id={doc_id}"
            fnet_exibir_url = f"https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id={doc_id}"
        elif main_doc_url:
            if "cvm.gov.br" in main_doc_url or main_doc_url.startswith("http://"):
                viewer_url = f"/api/proxy-url?url={urllib.parse.quote(main_doc_url)}"
            else:
                viewer_url = main_doc_url
            download_url = main_doc_url
            fnet_viewer_url = main_doc_url
            fnet_exibir_url = main_doc_url
        else:
            viewer_url = ""
            download_url = None
            fnet_viewer_url = None
            fnet_exibir_url = None

        return {
            "idNoticia": id_noticia,
            "title": title,
            "rawContent": content_text,
            "hasDocument": has_document,
            "documentId": doc_id,
            "mainDocUrl": main_doc_url,
            "viewerUrl": viewer_url,
            "downloadUrl": download_url,
            "fnetViewerUrl": fnet_viewer_url,
            "fnetExibirUrl": fnet_exibir_url,
            "foundUrls": urls
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar detalhes da notícia: {str(e)}")

@app.get("/api/proxy-url")
def proxy_url(url: str = Query(...)):
    try:
        if not (url.startswith("https://") or url.startswith("http://")):
            raise HTTPException(status_code=400, detail="URL inválida")
        
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as res:
            content = res.read()
            content_type = res.headers.get("Content-Type", "text/html; charset=utf-8")
        
        if "text/html" in content_type.lower():
            html_str = content.decode("utf-8", errors="ignore")
            parsed_url = urllib.parse.urlparse(url)
            base_href = f"{parsed_url.scheme}://{parsed_url.netloc}/"
            base_tag = f'<base href="{base_href}">'
            if "<head>" in html_str.lower():
                html_str = re.sub(r'(<head[^>]*>)', r'\1' + base_tag, html_str, count=1, flags=re.IGNORECASE)
            else:
                html_str = base_tag + html_str
            content = html_str.encode("utf-8")

        response = Response(content=content, media_type=content_type)
        response.headers["X-Frame-Options"] = "ALLOWALL"
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    except Exception as e:
        fallback_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; background: #F4F6F9; color: #0F172A; text-align: center; padding: 20px; }}
                .card {{ background: #FFFFFF; border: 1px solid #E2E8F0; padding: 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 30, 98, 0.06); max-width: 440px; }}
                h3 {{ color: #001E62; margin-bottom: 8px; font-size: 16px; font-weight: 700; }}
                p {{ color: #64748B; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }}
                .btn {{ display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; background: #0050A1; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px; }}
                .btn:hover {{ background: #003D7A; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h3>Documento Oficial Externo</h3>
                <p>Este documento está disponível diretamente no portal oficial regulatório.</p>
                <a href="{url}" target="_blank" class="btn">🔗 Abrir Documento Oficial</a>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=fallback_html, status_code=200)

@app.get("/api/proxy-document/{doc_id}")
def proxy_document(doc_id: str):
    try:
        url = f"https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id={doc_id}"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as res:
            content = res.read()
            content_type = res.headers.get("Content-Type", "text/html; charset=utf-8")

        if "text/html" in content_type.lower():
            html_str = content.decode("utf-8", errors="ignore")
            base_tag = '<base href="https://fnet.bmfbovespa.com.br/fnet/publico/">'
            if "<head>" in html_str.lower():
                html_str = re.sub(r'(<head[^>]*>)', r'\1' + base_tag, html_str, count=1, flags=re.IGNORECASE)
            else:
                html_str = base_tag + html_str
            content = html_str.encode("utf-8")

        response = Response(content=content, media_type=content_type)
        response.headers["X-Frame-Options"] = "ALLOWALL"
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response
    except Exception as e:
        fallback_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; background: #F4F6F9; color: #0F172A; text-align: center; padding: 20px; }}
                .card {{ background: #FFFFFF; border: 1px solid #E2E8F0; padding: 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 30, 98, 0.06); max-width: 440px; }}
                h3 {{ color: #001E62; margin-bottom: 8px; font-size: 17px; }}
                p {{ color: #64748B; font-size: 13.5px; line-height: 1.5; margin-bottom: 16px; }}
                .btn {{ display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: #0050A1; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px; transition: 0.18s ease; }}
                .btn:hover {{ background: #003D7A; }}
            </style>
        </head>
        <body>
            <div class="card">
                <h3>Documento Oficial B3 / Fundos.NET</h3>
                <p>Este documento está disponível diretamente para leitura no portal oficial da B3.</p>
                <a href="https://fnet.bmfbovespa.com.br/fnet/publico/visualizarDocumento?id={doc_id}" target="_blank" class="btn">🔗 Abrir Documento Oficial</a>
            </div>
        </body>
        </html>
        """
        return HTMLResponse(content=fallback_html, status_code=200)

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "B3 Plantão Monitor"}

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    favicon_file = os.path.join(STATIC_DIR, "favicon.svg")
    if os.path.exists(favicon_file):
        return FileResponse(favicon_file, media_type="image/svg+xml")
    return Response(status_code=204)

@app.get("/")
def read_root():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("<h1>B3 Plantão Monitor</h1><p>Frontend estático em inicialização...</p>")

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
