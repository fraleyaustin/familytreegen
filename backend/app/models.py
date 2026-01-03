import json
from datetime import datetime
from .db import get_db_connection

class Tree:
    @staticmethod
    def create(tree_id, name="Untitled Tree"):
        """Create a new tree with default data."""
        default_data = {
            "version": "1.0",
            "nodes": [],
            "edges": [],
            "decorations": [],
            "viewport": {"zoom": 1, "panX": 0, "panY": 0}
        }
        
        with get_db_connection() as conn:
            conn.execute(
                "INSERT INTO trees (id, name, data) VALUES (?, ?, ?)",
                (tree_id, name, json.dumps(default_data))
            )
            conn.commit()
        
        return Tree.get_by_id(tree_id)
    
    @staticmethod
    def get_by_id(tree_id):
        """Get a tree by ID."""
        with get_db_connection() as conn:
            row = conn.execute(
                "SELECT id, name, data, updated_at FROM trees WHERE id = ?",
                (tree_id,)
            ).fetchone()
            
            if row:
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "data": json.loads(row["data"]),
                    "updated_at": row["updated_at"]
                }
        return None
    
    @staticmethod
    def get_all():
        """Get all trees (summary only)."""
        with get_db_connection() as conn:
            rows = conn.execute(
                "SELECT id, name, updated_at FROM trees ORDER BY updated_at DESC"
            ).fetchall()
            
            return [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "updated_at": row["updated_at"]
                }
                for row in rows
            ]
    
    @staticmethod
    def update(tree_id, name=None, data=None):
        """Update a tree's name and/or data."""
        with get_db_connection() as conn:
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = ?")
                params.append(name)
            
            if data is not None:
                updates.append("data = ?")
                params.append(json.dumps(data))
            
            updates.append("updated_at = ?")
            params.append(datetime.now().isoformat())
            
            params.append(tree_id)
            
            conn.execute(
                f"UPDATE trees SET {', '.join(updates)} WHERE id = ?",
                params
            )
            conn.commit()
        
        return Tree.get_by_id(tree_id)
    
    @staticmethod
    def delete(tree_id):
        """Delete a tree."""
        with get_db_connection() as conn:
            conn.execute("DELETE FROM trees WHERE id = ?", (tree_id,))
            conn.commit()
