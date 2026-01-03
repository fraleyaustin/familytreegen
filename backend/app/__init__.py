from flask import Flask, send_from_directory
from .db import init_db
import os

def create_app():
    app = Flask(__name__, 
                static_folder='static',
                template_folder='templates')
    
    # Initialize database
    init_db()
    
    # Ensure uploads directory exists
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Register blueprints
    from .routes.trees import trees_bp
    app.register_blueprint(trees_bp, url_prefix='/api')
    
    # Main route
    @app.route('/')
    def index():
        from flask import render_template
        return render_template('index.html')
    
    # Serve uploaded files (outside API blueprint)
    @app.route('/uploads/<tree_id>/<filename>')
    def serve_upload(tree_id, filename):
        tree_upload_dir = os.path.join(uploads_dir, tree_id)
        return send_from_directory(tree_upload_dir, filename)
    
    return app
