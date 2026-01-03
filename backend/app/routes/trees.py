from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
import uuid
import os
import secrets

from ..models import Tree

trees_bp = Blueprint('trees', __name__)

UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@trees_bp.route('/trees', methods=['POST'])
def create_tree():
    """Create a new tree."""
    data = request.get_json() or {}
    name = data.get('name', 'Untitled Tree')
    
    tree_id = str(uuid.uuid4())
    tree = Tree.create(tree_id, name)
    
    return jsonify(tree), 201

@trees_bp.route('/trees', methods=['GET'])
def get_trees():
    """Get all trees."""
    trees = Tree.get_all()
    return jsonify(trees)

@trees_bp.route('/trees/<tree_id>', methods=['GET'])
def get_tree(tree_id):
    """Get a specific tree."""
    tree = Tree.get_by_id(tree_id)
    
    if not tree:
        return jsonify({"error": "Tree not found"}), 404
    
    return jsonify(tree)

@trees_bp.route('/trees/<tree_id>', methods=['PUT'])
def update_tree(tree_id):
    """Update a tree."""
    tree = Tree.get_by_id(tree_id)
    
    if not tree:
        return jsonify({"error": "Tree not found"}), 404
    
    data = request.get_json()
    name = data.get('name')
    tree_data = data.get('data')
    
    Tree.update(tree_id, name=name, data=tree_data)
    
    return jsonify({"ok": True})

@trees_bp.route('/trees/<tree_id>', methods=['DELETE'])
def delete_tree(tree_id):
    """Delete a tree."""
    tree = Tree.get_by_id(tree_id)
    
    if not tree:
        return jsonify({"error": "Tree not found"}), 404
    
    Tree.delete(tree_id)
    
    return jsonify({"ok": True})

@trees_bp.route('/trees/<tree_id>/upload', methods=['POST'])
def upload_file(tree_id):
    """Upload a file for a tree."""
    tree = Tree.get_by_id(tree_id)
    
    if not tree:
        return jsonify({"error": "Tree not found"}), 404
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        # Create tree-specific upload directory
        tree_upload_dir = os.path.join(UPLOADS_DIR, tree_id)
        os.makedirs(tree_upload_dir, exist_ok=True)
        
        # Generate random filename to prevent collisions
        ext = secure_filename(file.filename).rsplit('.', 1)[1].lower()
        random_name = f"{secrets.token_hex(16)}.{ext}"
        
        filepath = os.path.join(tree_upload_dir, random_name)
        file.save(filepath)
        
        # Return URL relative to the app
        url = f"/uploads/{tree_id}/{random_name}"
        return jsonify({"url": url})
    
    return jsonify({"error": "Invalid file type"}), 400
