# Family Tree Builder

A web application for creating and managing family trees with a visual Visio-like canvas editor. Built with Flask, SQLite, and Konva.js.

## Features

- 🌳 **Visual Tree Editor**: Drag-and-drop interface powered by Konva.js
- 👤 **Person Cards**: Add family members with detailed information
  - Photos with proper aspect ratio preservation
  - Birth date and location
  - Death date and burial location
- ↔️ **Relationships**: Connect people with visual lines
  - Solid and dashed line styles
  - Smart T-junction connections for multiple parents
- 🎨 **Decorations**: 70+ emojis and resizable text notes
- 🌙 **Dark Mode**: Toggle between light and dark themes
- 🔍 **Zoom & Pan**: Mouse wheel zoom and canvas panning
- 💾 **Persistent Storage**: SQLite database for reliable data storage
- 📸 **Photo Uploads**: Upload and display photos for each person
- 🔄 **Smart Auto-Save**: Debounced auto-save (saves 2 seconds after changes stop)
- 📱 **Responsive UI**: Clean, modern interface with sidebar and properties panel

## Tech Stack

- **Backend**: Python Flask with blueprints
- **Database**: SQLite
- **Web Server**: Gunicorn + Nginx (production)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Canvas Library**: Konva.js
- **File Storage**: Local filesystem

## Project Structure

```
familytree/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Flask app factory
│   │   ├── db.py                # Database connection
│   │   ├── models.py            # Tree model
│   │   ├── routes/
│   │   │   └── trees.py         # API routes
│   │   ├── static/
│   │   │   ├── app.js           # Frontend JavaScript
│   │   │   └── style.css        # Styles
│   │   └── templates/
│   │       └── index.html       # Main page
│   ├── wsgi.py                  # WSGI entry point
│   └── requirements.txt         # Python dependencies
├── deploy/
│   ├── nginx_familytree.conf    # Nginx config example
│   └── familytree.service       # Systemd service example
├── uploads/                      # Uploaded images (created at runtime)
├── Makefile                      # Build automation
├── README.md                     # This file
└── .gitignore                    # Git ignore rules
```

## Local Setup

### Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

### Installation Steps

1. **Clone or download the project**

2. **Run setup** (creates virtual environment and installs dependencies):
   ```bash
   make setup
   ```

3. **Start the development server**:
   ```bash
   make run
   ```

4. **Open your browser** and navigate to:
   ```
   http://127.0.0.1:5000
   ```

### Manual Setup (Alternative)

If you prefer not to use Make:

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Create necessary directories
mkdir uploads
mkdir backend/app/instance

# Run the development server
cd backend
python -m flask --app app run --debug --host 0.0.0.0 --port 5000
```

## Usage

### Creating a Family Tree

1. Click **"+ New Tree"** in the left sidebar
2. Enter a name for your tree
3. The tree will be created and automatically loaded into the editor

### Adding People

1. Click **"👤 Add Person"** in the toolbar
2. A new person card will appear on the canvas
3. Drag it to the desired position
4. Click the card to select it
5. In the right panel, edit the person's details:
   - Name
   - Birth date and birth location
   - Death date and burial location
6. Click **"Upload Photo"** to add a photo (automatically preserves aspect ratio)

### Connecting People

1. Click **"↔️ Add Line"** button (it will highlight)
2. Select line style (Solid or Dashed) from dropdown
3. Click the first person
4. Click the second person
5. A line will be drawn connecting them
6. Multiple parents connecting to one child automatically create T-junction connectors

### Adding Decorations

- Click **"😊 Add Emoji"** to open emoji picker with 70+ options (hearts, family symbols, celebrations, religious symbols, etc.)
- Click **"📝 Add Note"** to add a resizable text note
  - Drag the note to reposition
  - Drag the bottom-right corner handle to resize
  - Click to select and edit text in properties panel

### Zoom & Pan

- **Zoom**: Use mouse wheel or click zoom buttons (🔍+ / 🔍-)
- **Pan**: Drag the canvas background
- **Reset**: Click 🔄 Reset to return to default zoom level

### Dark Mode

- Click **🌙 Dark Mode** button to toggle between light and dark themes
- Preference is saved in browser localStorage

### Saving

- Auto-save activates 2 seconds after you stop making changes
- Click **"💾 Save"** to manually save your tree immediately
- Save status is displayed in the toolbar

### Loading Trees

- Click any tree name in the left sidebar to load it
- Your current work will be auto-saved before switching

### Deleting

- Select a tree and click **"🗑️ Delete"** to remove it
- Select a person/decoration and use the **"Delete"** button in the properties panel

## API Endpoints

The backend provides a RESTful API:

### Trees

- **POST** `/api/trees`
  - Create a new tree
  - Body: `{ "name": "My Tree" }` (optional)
  - Returns: Tree object with `id`, `name`, and `data`

- **GET** `/api/trees`
  - List all trees
  - Returns: Array of tree summaries

- **GET** `/api/trees/<id>`
  - Get a specific tree
  - Returns: Full tree object with data

- **PUT** `/api/trees/<id>`
  - Update a tree
  - Body: `{ "name": "...", "data": {...} }`
  - Returns: `{ "ok": true }`

- **DELETE** `/api/trees/<id>`
  - Delete a tree
  - Returns: `{ "ok": true }`

### File Upload

- **POST** `/api/trees/<id>/upload`
  - Upload an image for a tree
  - Content-Type: `multipart/form-data`
  - Field name: `file`
  - Returns: `{ "url": "/uploads/<id>/<filename>" }`

### Static Files

- **GET** `/uploads/<tree_id>/<filename>`
  - Serve uploaded images

## Data Storage

### Database

- **Location**: `backend/app/instance/app.db`
- **Type**: SQLite
- **Schema**: Single `trees` table with columns:
  - `id` (TEXT, primary key)
  - `name` (TEXT)
  - `data` (TEXT, JSON blob)
  - `created_at` (TIMESTAMP)
  - `updated_at` (TIMESTAMP)

### Canvas Data Format

Each tree's `data` field contains:

```json
{
  "version": "1.0",
  "nodes": [
    {
      "id": "person_123456",
      "type": "person",
      "x": 100,
      "y": 150,
      "name": "John Doe",
      "photo": "/uploads/tree-id/photo.jpg",
      "birthDate": "January 1, 1950",
      "birthLocation": "New York, NY",
      "deathDate": "December 31, 2020",
      "burialLocation": "Green Lawn Cemetery"
    }
  ],
  "edges": [
    {
      "id": "edge_123456",
      "type": "line",
      "from": "person_123456",
      "to": "person_789012",
      "lineStyle": "solid"
    }
  ],
  "decorations": [
    {
      "id": "emoji_123456",
      "type": "emoji",
      "emoji": "❤️",
      "x": 200,
      "y": 200
    },
    {
      "id": "note_123456",
      "type": "note",
      "x": 300,
      "y": 100,
      "width": 180,
      "height": 100,
      "text": "Note content"
    }
  ],
  "viewport": {
    "zoom": 1,
    "panX": 0,
    "panY": 0
  }
}
```

### Uploads

- **Location**: `uploads/<tree_id>/`
- **Naming**: Random hex strings for security
- **Formats**: PNG, JPG, JPEG, GIF, WEBP
- **Size Limit**: 25MB (configured in nginx)

## Production Deployment

### Using Gunicorn + Nginx

1. **Update paths** in deployment files:
   - Edit `deploy/nginx_familytree.conf`
   - Edit `deploy/familytree.service`
   - Replace `/path/to/FamilyTree` with your actual path

2. **Install Nginx** (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt install nginx
   
   # CentOS/RHEL
   sudo yum install nginx
   ```

3. **Copy nginx configuration**:
   ```bash
   sudo cp deploy/nginx_familytree.conf /etc/nginx/sites-available/familytree
   sudo ln -s /etc/nginx/sites-available/familytree /etc/nginx/sites-enabled/
   sudo nginx -t  # Test configuration
   sudo systemctl reload nginx
   ```

4. **Set up systemd service**:
   ```bash
   sudo cp deploy/familytree.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable familytree
   sudo systemctl start familytree
   sudo systemctl status familytree
   ```

5. **Create log directory**:
   ```bash
   sudo mkdir -p /var/log/familytree
   sudo chown www-data:www-data /var/log/familytree
   ```

6. **Set permissions**:
   ```bash
   sudo chown -R www-data:www-data /path/to/FamilyTree/uploads
   sudo chown -R www-data:www-data /path/to/FamilyTree/backend/app/instance
   ```

### Running with Gunicorn Only (without Nginx)

```bash
make run-gunicorn
```

Or manually:

```bash
cd backend
../venv/bin/gunicorn -w 4 -b 127.0.0.1:8000 wsgi:app
```

## Development

### Running Tests

```bash
make lint
```

### Clean Up

Remove virtual environment and generated files:

```bash
make clean
```

### Code Structure

- **Flask Blueprints**: API routes are organized in `backend/app/routes/`
- **Models**: Data access layer in `backend/app/models.py`
- **Database**: Connection management in `backend/app/db.py`
- **Frontend**: Single-page app in `backend/app/static/app.js`

## Troubleshooting

### Database not created

The database is created automatically when the app starts. If you encounter issues:

```bash
rm -rf backend/app/instance
make run
```

### Uploads not working

Ensure the uploads directory exists and has proper permissions:

```bash
mkdir -p uploads
# On Linux/Mac:
chmod 755 uploads
```

### Port already in use

Change the port in the Makefile or run:

```bash
cd backend
python -m flask --app app run --port 5001
```

### Gunicorn import errors

Make sure you're in the correct directory and virtual environment is activated:

```bash
cd backend
source ../venv/bin/activate  # On Linux/Mac
..\venv\Scripts\activate     # On Windows
```

## Browser Compatibility

- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

Features tested across all browsers:
- Drag and drop functionality
- Mouse wheel zoom
- File uploads
- Dark mode toggle
- Canvas rendering with Konva.js

## Performance Optimizations

- **Debounced Auto-Save**: Saves only after 2 seconds of inactivity to reduce server load
- **Batch Drawing**: Uses `batchDraw()` for efficient canvas updates during drag operations
- **Smart Connection Updates**: Only redraws connections when nodes move, not on every pixel
- **Cached Calculations**: Pointer positions and scales are cached to avoid redundant calculations
- **Optimized T-Junctions**: Efficiently groups and renders multiple parent connections

## License

This project is open source and available for personal and commercial use.

## Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

## Future Enhancements

Potential features for future versions:

- [ ] User authentication and multi-user support
- [ ] Export to PDF/PNG
- [ ] Import from GEDCOM format
- [ ] Undo/redo functionality
- [ ] More relationship types (parent, child, sibling, spouse)
- [ ] Search and filter functionality
- [ ] Timeline view
- [ ] Mobile app
- [ ] Real-time collaboration
- [ ] More decoration options (photos, videos, documents)

## Support

For issues or questions, please create an issue in the project repository.

---

Built with ❤️ using Flask and Konva.js
