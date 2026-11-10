"""
Backend servidor Flask integrado con importador Liga Educa
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import requests
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)

# --- FUNCIÓN DE EXTRACCIÓN Y SINCRONIZACIÓN LIGA EDUCA ---
def ejecutar_sincronizacion_liga():
    """
    Función que realiza la extracción de partidos/datos de la Liga Educa
    y actualiza la base de datos de Futbase.
    """
    logging.info("Iniciando sincronización con Liga Educa...")
    try:
        # Aquí va la lógica principal de extracción (scraping/API) de futbase-importador-liga-educa
        # Ejemplo simulado:
        # response = requests.get("https://api.ligaeduca.com/partidos")
        # datos = response.json()
        # guardar_en_db(datos)
        
        logging.info("Sincronización completada con éxito.")
        return True, "Datos de la Liga Educa sincronizados correctamente."
    except Exception as e:
        logging.error(f"Error durante la sincronización: {e}")
        return False, str(e)

# --- ENDPOINTS API ---
@app.route('/api/sync-liga', methods=['POST'])
def sync_liga_endpoint():
    """Endpoint llamado manualmente desde el botón de React Native"""
    exito, mensaje = ejecutar_sincronizacion_liga()
    if exito:
        return jsonify({"status": "success", "message": mensaje}), 200
    else:
        return jsonify({"status": "error", "message": mensaje}), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200

# --- PROGRAMADOR TAREA AUTOMÁTICA EN SEGUNDO PLANO ---
scheduler = BackgroundScheduler()
# Ejecuta la sincronización cada 12 horas automáticamente
scheduler.add_job(func=ejecutar_sincronizacion_liga, trigger="interval", hours=12)
scheduler.start()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
