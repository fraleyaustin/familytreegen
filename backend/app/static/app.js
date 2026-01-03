// Family Tree Builder App
class FamilyTreeApp {
    constructor() {
        this.currentTree = null;
        this.stage = null;
        this.layer = null;
        this.trees = [];
        this.unsavedChanges = false;
        this.mode = 'select'; // select, addLine
        this.lineStartNode = null;
        this.autoSaveInterval = null;
        this.saveTimeout = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadTrees();
        this.startAutoSave();
        this.loadDarkMode();
    }
    
    setupCanvas() {
        const container = document.getElementById('canvas');
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        
        this.stage = new Konva.Stage({
            container: 'canvas',
            width: width,
            height: height,
            draggable: true
        });
        
        this.layer = new Konva.Layer();
        this.stage.add(this.layer);
        
        // Hide canvas initially
        document.getElementById('canvas').style.display = 'none';
        
        // Handle window resize
        window.addEventListener('resize', () => {
            const container = document.getElementById('canvas');
            this.stage.width(container.offsetWidth);
            this.stage.height(container.offsetHeight);
        });
        
        // Mouse wheel zoom
        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            
            const oldScale = this.stage.scaleX();
            const pointer = this.stage.getPointerPosition();
            
            const mousePointTo = {
                x: (pointer.x - this.stage.x()) / oldScale,
                y: (pointer.y - this.stage.y()) / oldScale
            };
            
            const direction = e.evt.deltaY > 0 ? -1 : 1;
            const scaleBy = 1.05;
            const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
            
            // Limit zoom range
            if (newScale < 0.3 || newScale > 3) return;
            
            this.stage.scale({ x: newScale, y: newScale });
            
            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale
            };
            
            this.stage.position(newPos);
            this.stage.batchDraw();
        });
    }
    
    setupEventListeners() {
        // Tree management
        document.getElementById('createTreeBtn').addEventListener('click', () => this.createTree());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveTree());
        document.getElementById('deleteBtn').addEventListener('click', () => this.deleteTree());
        
        // Zoom controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetZoomBtn').addEventListener('click', () => this.resetZoom());
        
        // Dark mode toggle
        document.getElementById('darkModeToggle').addEventListener('click', () => this.toggleDarkMode());
        
        // Add items
        document.getElementById('addPersonBtn').addEventListener('click', () => this.addPerson());
        document.getElementById('addLineBtn').addEventListener('click', () => this.toggleLineMode());
        document.getElementById('addNoteBtn').addEventListener('click', () => this.addNote());
        
        // Emoji picker
        document.getElementById('addEmojiBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            const picker = document.getElementById('emojiPicker');
            picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
        });
        
        document.getElementById('emojiPicker').addEventListener('click', (e) => {
            if (e.target.classList.contains('emoji-item')) {
                this.addEmoji(e.target.dataset.emoji);
                document.getElementById('emojiPicker').style.display = 'none';
            }
        });
        
        // Close emoji picker when clicking elsewhere
        document.addEventListener('click', (e) => {
            const picker = document.getElementById('emojiPicker');
            const btn = document.getElementById('addEmojiBtn');
            if (!picker.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                picker.style.display = 'none';
            }
        });
        
        // Photo upload
        document.getElementById('photoUpload').addEventListener('change', (e) => this.handlePhotoUpload(e));
        
        // Stage click for deselection
        this.stage.on('click', (e) => {
            if (e.target === this.stage) {
                this.deselectAll();
            }
        });
    }
    
    async loadTrees() {
        try {
            const response = await fetch('/api/trees');
            this.trees = await response.json();
            this.renderTreeList();
        } catch (error) {
            console.error('Failed to load trees:', error);
        }
    }
    
    renderTreeList() {
        const treeList = document.getElementById('treeList');
        
        if (this.trees.length === 0) {
            treeList.innerHTML = '<p style="padding: 10px; color: #999;">No trees yet. Create one!</p>';
            return;
        }
        
        treeList.innerHTML = this.trees.map(tree => `
            <div class="tree-item ${this.currentTree && this.currentTree.id === tree.id ? 'active' : ''}" 
                 data-id="${tree.id}">
                <div class="tree-item-name">${tree.name}</div>
                <div class="tree-item-date">${new Date(tree.updated_at).toLocaleDateString()}</div>
            </div>
        `).join('');
        
        // Add click handlers
        treeList.querySelectorAll('.tree-item').forEach(item => {
            item.addEventListener('click', () => {
                this.loadTree(item.dataset.id);
            });
        });
    }
    
    async createTree() {
        const name = prompt('Enter tree name:', 'My Family Tree');
        if (!name) return;
        
        try {
            const response = await fetch('/api/trees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            
            const tree = await response.json();
            this.trees.unshift(tree);
            this.renderTreeList();
            await this.loadTree(tree.id);
            this.updateSaveStatus('Tree created');
        } catch (error) {
            console.error('Failed to create tree:', error);
            alert('Failed to create tree');
        }
    }
    
    async loadTree(treeId) {
        try {
            const response = await fetch(`/api/trees/${treeId}`);
            this.currentTree = await response.json();
            
            document.getElementById('currentTreeName').textContent = this.currentTree.name;
            document.getElementById('canvas').style.display = 'block';
            document.getElementById('noTreeMessage').style.display = 'none';
            
            this.renderTreeList();
            this.renderCanvas();
            this.unsavedChanges = false;
            this.updateSaveStatus('Loaded');
        } catch (error) {
            console.error('Failed to load tree:', error);
            alert('Failed to load tree');
        }
    }
    
    renderCanvas() {
        this.layer.destroyChildren();
        
        const data = this.currentTree.data;
        
        // Render nodes first (needed for connection calculations)
        if (data.nodes) {
            data.nodes.forEach(node => this.createPersonFromData(node));
        }
        
        // Render decorations
        if (data.decorations) {
            data.decorations.forEach(decoration => {
                if (decoration.type === 'emoji') {
                    this.createEmojiFromData(decoration);
                } else if (decoration.type === 'note') {
                    this.createNoteFromData(decoration);
                }
            });
        }
        
        // Render edges with T-junctions (after nodes are created)
        if (data.edges && data.edges.length > 0) {
            this.redrawAllConnections();
        }
        
        this.layer.draw();
    }
    
    addPerson() {
        if (!this.currentTree) {
            alert('Please select or create a tree first');
            return;
        }
        
        const person = {
            id: 'person_' + Date.now(),
            type: 'person',
            x: 100 + Math.random() * 200,
            y: 100 + Math.random() * 200,
            name: 'New Person',
            photo: null,
            birthDate: '',
            birthLocation: '',
            deathDate: '',
            burialLocation: ''
        };
        
        this.currentTree.data.nodes.push(person);
        this.createPersonFromData(person);
        this.markUnsaved();
    }
    
    createPersonFromData(data) {
        const group = new Konva.Group({
            x: data.x,
            y: data.y,
            draggable: true,
            id: data.id
        });
        
        // Calculate card height based on content
        let cardHeight = 220; // Base height
        if (data.deathDate) cardHeight += 15;
        if (data.burialLocation) cardHeight += 15;
        
        // Background card
        const card = new Konva.Rect({
            width: 180,
            height: cardHeight,
            fill: 'white',
            stroke: '#4a90e2',
            strokeWidth: 2,
            cornerRadius: 8,
            shadowColor: 'black',
            shadowBlur: 10,
            shadowOpacity: 0.2,
            shadowOffset: { x: 2, y: 2 }
        });
        
        group.add(card);
        
        // Photo placeholder or image
        if (data.photo) {
            const imageObj = new Image();
            imageObj.onload = () => {
                // Calculate dimensions to maintain aspect ratio
                const maxWidth = 150;
                const maxHeight = 100;
                let imgWidth = imageObj.width;
                let imgHeight = imageObj.height;
                
                // Scale to fit
                const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                imgWidth = imgWidth * ratio;
                imgHeight = imgHeight * ratio;
                
                // Center the image
                const xPos = 15 + (maxWidth - imgWidth) / 2;
                const yPos = 10 + (maxHeight - imgHeight) / 2;
                
                const photo = new Konva.Image({
                    x: xPos,
                    y: yPos,
                    width: imgWidth,
                    height: imgHeight,
                    image: imageObj,
                    cornerRadius: 4
                });
                group.add(photo);
                this.layer.batchDraw();
            };
            imageObj.src = data.photo;
        } else {
            const photoPlaceholder = new Konva.Rect({
                x: 15,
                y: 10,
                width: 150,
                height: 100,
                fill: '#e0e0e0',
                cornerRadius: 4
            });
            
            const photoIcon = new Konva.Text({
                x: 15,
                y: 40,
                width: 150,
                text: '👤',
                fontSize: 50,
                align: 'center'
            });
            
            group.add(photoPlaceholder);
            group.add(photoIcon);
        }
        
        // Name text
        const nameText = new Konva.Text({
            x: 10,
            y: 115,
            width: 160,
            text: data.name,
            fontSize: 16,
            fontFamily: 'Arial',
            fontStyle: 'bold',
            fill: '#333',
            align: 'center',
            wrap: 'word'
        });
        group.add(nameText);
        
        let yPos = 140;
        
        // Birth info
        const birthText = new Konva.Text({
            x: 10,
            y: yPos,
            width: 160,
            text: `Birth: ${data.birthDate || 'N/A'}`,
            fontSize: 11,
            fontFamily: 'Arial',
            fill: '#555',
            align: 'left'
        });
        group.add(birthText);
        yPos += 15;
        
        // Birth location - always show
        const birthLocText = new Konva.Text({
            x: 10,
            y: yPos,
            width: 160,
            text: data.birthLocation || '',
            fontSize: 10,
            fontFamily: 'Arial',
            fill: '#777',
            align: 'left',
            wrap: 'word'
        });
        group.add(birthLocText);
        yPos += 15;
        
        // Death info - always show if date exists
        if (data.deathDate) {
            yPos += 5; // Small gap
            const deathText = new Konva.Text({
                x: 10,
                y: yPos,
                width: 160,
                text: `Death: ${data.deathDate}`,
                fontSize: 11,
                fontFamily: 'Arial',
                fill: '#555',
                align: 'left'
            });
            group.add(deathText);
            yPos += 15;
            
            // Burial location - show if death date exists
            const burialText = new Konva.Text({
                x: 10,
                y: yPos,
                width: 160,
                text: `Burial: ${data.burialLocation || ''}`,
                fontSize: 10,
                fontFamily: 'Arial',
                fill: '#777',
                align: 'left',
                wrap: 'word'
            });
            group.add(burialText);
        }
        
        // Event handlers
        group.on('click', () => {
            if (this.mode === 'addLine') {
                this.handleLineConnection(group);
            } else {
                this.selectNode(group, data);
            }
        });
        
        group.on('dragmove', () => {
            this.updateConnections(group);
        });
        
        group.on('dragend', () => {
            // Update node position in data
            const node = this.currentTree.data.nodes.find(n => n.id === data.id);
            if (node) {
                node.x = group.x();
                node.y = group.y();
            }
            this.markUnsaved();
        });
        
        this.layer.add(group);
        this.layer.draw();
        
        return group;
    }
    
    toggleLineMode() {
        this.mode = this.mode === 'addLine' ? 'select' : 'addLine';
        const btn = document.getElementById('addLineBtn');
        const styleSelector = document.getElementById('lineStyleSelector');
        
        if (this.mode === 'addLine') {
            btn.classList.add('active');
            styleSelector.style.display = 'inline-block';
            this.updateSaveStatus('Click two people to connect');
            this.lineStartNode = null;
        } else {
            btn.classList.remove('active');
            styleSelector.style.display = 'none';
            this.updateSaveStatus('');
            this.lineStartNode = null;
        }
    }
    
    handleLineConnection(node) {
        if (!this.lineStartNode) {
            this.lineStartNode = node;
            this.updateSaveStatus('Click second person to complete connection');
        } else {
            if (this.lineStartNode !== node) {
                this.createLine(this.lineStartNode, node);
                this.updateSaveStatus('Connection created');
            }
            this.lineStartNode = null;
            this.toggleLineMode();
        }
    }
    
    createLine(node1, node2) {
        const lineStyle = document.getElementById('lineStyleSelector').value;
        
        const edge = {
            id: 'edge_' + Date.now(),
            type: 'line',
            from: node1.id(),
            to: node2.id(),
            lineStyle: lineStyle
        };
        
        this.currentTree.data.edges.push(edge);
        this.redrawAllConnections();
        this.markUnsaved();
    }
    
    redrawAllConnections() {
        // Remove all existing lines from canvas
        this.layer.find('Line').forEach(line => line.destroy());
        
        if (!this.currentTree.data.edges || this.currentTree.data.edges.length === 0) {
            return;
        }
        
        // Group edges by target (child) node to detect multiple parents
        const edgesByTarget = {};
        this.currentTree.data.edges.forEach(edge => {
            if (!edgesByTarget[edge.to]) {
                edgesByTarget[edge.to] = [];
            }
            edgesByTarget[edge.to].push(edge);
        });
        
        // Track which edges we've already drawn
        const drawnEdges = new Set();
        
        // Draw edges, creating T-junctions for multiple parents
        Object.keys(edgesByTarget).forEach(targetId => {
            const edges = edgesByTarget[targetId];
            
            if (edges.length >= 2) {
                // Multiple parents - create T-junction
                const childNode = this.stage.findOne('#' + targetId);
                if (!childNode) return;
                
                // Get the card to determine its actual height
                const childCard = childNode.findOne('Rect');
                const childCardHeight = childCard ? childCard.height() : 220;
                const childX = childNode.x() + 90;
                const childY = childNode.y() + childCardHeight / 2;
                
                // Collect all valid parent positions
                const parents = [];
                edges.forEach(edge => {
                    const parentNode = this.stage.findOne('#' + edge.from);
                    if (parentNode) {
                        const parentCard = parentNode.findOne('Rect');
                        const parentCardHeight = parentCard ? parentCard.height() : 220;
                        parents.push({
                            x: parentNode.x() + 90,
                            y: parentNode.y() + parentCardHeight / 2,
                            edge: edge
                        });
                    }
                });
                
                if (parents.length < 2) return; // Need at least 2 parents for T-junction
                
                // Calculate junction point
                // Use the average Y of parents, and center X between leftmost and rightmost parents
                const avgParentY = parents.reduce((sum, p) => sum + p.y, 0) / parents.length;
                const minParentX = Math.min(...parents.map(p => p.x));
                const maxParentX = Math.max(...parents.map(p => p.x));
                const junctionX = (minParentX + maxParentX) / 2;
                const junctionY = avgParentY + (childY - avgParentY) * 0.5; // Halfway between parents and child
                
                // Draw horizontal line between leftmost and rightmost parent connections
                const horizontalLine = new Konva.Line({
                    points: [minParentX, junctionY, maxParentX, junctionY],
                    stroke: '#666',
                    strokeWidth: 3,
                    lineCap: 'round',
                    id: 'junction_h_' + targetId
                });
                this.layer.add(horizontalLine);
                horizontalLine.moveToBottom();
                
                // Draw vertical line from junction center to child
                const verticalLine = new Konva.Line({
                    points: [junctionX, junctionY, childX, childY],
                    stroke: '#666',
                    strokeWidth: 3,
                    lineCap: 'round',
                    id: 'junction_v_' + targetId
                });
                this.layer.add(verticalLine);
                verticalLine.moveToBottom();
                
                // Draw lines from each parent down to the junction horizontal line
                parents.forEach(parent => {
                    const lineConfig = {
                        points: [parent.x, parent.y, parent.x, junctionY],
                        stroke: '#666',
                        strokeWidth: 3,
                        lineCap: 'round',
                        id: parent.edge.id
                    };
                    
                    // Apply line style from edge data
                    if (parent.edge.lineStyle === 'dashed') {
                        lineConfig.dash = [10, 5];
                    }
                    
                    const line = new Konva.Line(lineConfig);
                    line.setAttr('fromNode', parent.edge.from);
                    line.setAttr('toNode', parent.edge.to);
                    line.setAttr('lineStyle', parent.edge.lineStyle || 'solid');
                    line.on('click', () => this.selectLine(line, parent.edge));
                    
                    this.layer.add(line);
                    line.moveToBottom();
                    drawnEdges.add(parent.edge.id);
                });
            }
        });
        
        // Draw remaining single-parent edges
        this.currentTree.data.edges.forEach(edge => {
            if (drawnEdges.has(edge.id)) return;
            
            const fromNode = this.stage.findOne('#' + edge.from);
            const toNode = this.stage.findOne('#' + edge.to);
            
            if (!fromNode || !toNode) return;
            
            const fromCard = fromNode.findOne('Rect');
            const fromCardHeight = fromCard ? fromCard.height() : 220;
            const toCard = toNode.findOne('Rect');
            const toCardHeight = toCard ? toCard.height() : 220;
            
            const fromX = fromNode.x() + 90;
            const fromY = fromNode.y() + fromCardHeight / 2;
            const toX = toNode.x() + 90;
            const toY = toNode.y() + toCardHeight / 2;
            
            const lineConfig = {
                points: [fromX, fromY, toX, toY],
                stroke: '#666',
                strokeWidth: 3,
                lineCap: 'round',
                id: edge.id
            };
            
            if (edge.lineStyle === 'dashed') {
                lineConfig.dash = [10, 5];
            }
            
            const line = new Konva.Line(lineConfig);
            line.setAttr('fromNode', edge.from);
            line.setAttr('toNode', edge.to);
            line.setAttr('lineStyle', edge.lineStyle || 'solid');
            line.on('click', () => this.selectLine(line, edge));
            
            this.layer.add(line);
            line.moveToBottom();
        });
        
        this.layer.batchDraw();
    }
    
    createLineFromData(data) {
        // This method is kept for backward compatibility but now just calls redrawAllConnections
        this.redrawAllConnections();
    }
    
    updateConnections(movedNode) {
        // Redraw all connections to maintain T-junctions
        this.redrawAllConnections();
    }
    
    addEmoji(emoji) {
        if (!this.currentTree) {
            alert('Please select or create a tree first');
            return;
        }
        
        const decoration = {
            id: 'emoji_' + Date.now(),
            type: 'emoji',
            emoji: emoji,
            x: 300 + Math.random() * 200,
            y: 100 + Math.random() * 200
        };
        
        this.currentTree.data.decorations.push(decoration);
        this.createEmojiFromData(decoration);
        this.markUnsaved();
    }
    
    createEmojiFromData(data) {
        const emojiShape = new Konva.Text({
            x: data.x,
            y: data.y,
            text: data.emoji,
            fontSize: 40,
            draggable: true,
            id: data.id
        });
        
        emojiShape.on('dragend', () => {
            const decoration = this.currentTree.data.decorations.find(d => d.id === data.id);
            if (decoration) {
                decoration.x = emojiShape.x();
                decoration.y = emojiShape.y();
                this.markUnsaved();
            }
        });
        
        emojiShape.on('click', () => this.selectDecoration(emojiShape, data));
        
        this.layer.add(emojiShape);
        this.layer.draw();
    }
    
    addNote() {
        if (!this.currentTree) {
            alert('Please select or create a tree first');
            return;
        }
        
        const decoration = {
            id: 'note_' + Date.now(),
            type: 'note',
            x: 400 + Math.random() * 200,
            y: 100 + Math.random() * 200,
            width: 180,
            height: 100,
            text: 'Note text here'
        };
        
        this.currentTree.data.decorations.push(decoration);
        this.createNoteFromData(decoration);
        this.markUnsaved();
    }
    
    createNoteFromData(data) {
        // Ensure width and height exist
        if (!data.width) data.width = 180;
        if (!data.height) data.height = 100;
        
        const group = new Konva.Group({
            x: data.x,
            y: data.y,
            draggable: true,
            id: data.id
        });
        
        const bg = new Konva.Rect({
            width: data.width,
            height: data.height,
            fill: '#fffacd',
            stroke: '#f0e68c',
            strokeWidth: 1,
            cornerRadius: 4,
            shadowColor: 'black',
            shadowBlur: 5,
            shadowOpacity: 0.2,
            name: 'background'
        });
        
        const text = new Konva.Text({
            x: 10,
            y: 10,
            width: data.width - 20,
            height: data.height - 20,
            text: data.text || 'Note text here',
            fontSize: 14,
            fontFamily: 'Arial',
            fill: '#333',
            wrap: 'word',
            name: 'text'
        });
        
        // Resize handle (bottom-right corner)
        const resizeHandle = new Konva.Rect({
            x: data.width - 12,
            y: data.height - 12,
            width: 12,
            height: 12,
            fill: '#f0e68c',
            stroke: '#d4c470',
            strokeWidth: 1,
            cornerRadius: 2,
            name: 'resizeHandle',
            draggable: false
        });
        
        group.add(bg);
        group.add(text);
        group.add(resizeHandle);
        
        // Handle resize
        let isResizing = false;
        let startWidth, startHeight, startX, startY;
        
        resizeHandle.on('mousedown touchstart', (e) => {
            e.cancelBubble = true;
            isResizing = true;
            group.draggable(false);
            const pos = this.stage.getPointerPosition();
            startX = pos.x;
            startY = pos.y;
            startWidth = data.width;
            startHeight = data.height;
        });
        
        this.stage.on('mousemove touchmove', () => {
            if (isResizing && group.id() === data.id) {
                const pos = this.stage.getPointerPosition();
                if (!pos) return;
                
                const scale = this.stage.scaleX();
                const deltaX = (pos.x - startX) / scale;
                const deltaY = (pos.y - startY) / scale;
                
                const newWidth = Math.max(100, startWidth + deltaX);
                const newHeight = Math.max(60, startHeight + deltaY);
                
                bg.width(newWidth);
                bg.height(newHeight);
                text.width(newWidth - 20);
                text.height(newHeight - 20);
                resizeHandle.x(newWidth - 12);
                resizeHandle.y(newHeight - 12);
                
                this.layer.batchDraw();
            }
        });
        
        this.stage.on('mouseup touchend', () => {
            if (isResizing && group.id() === data.id) {
                isResizing = false;
                group.draggable(true);
                document.body.style.cursor = 'default';
                
                const decoration = this.currentTree.data.decorations.find(d => d.id === data.id);
                if (decoration) {
                    decoration.width = bg.width();
                    decoration.height = bg.height();
                    this.markUnsaved();
                }
            }
        });
        
        resizeHandle.on('mouseenter', () => {
            document.body.style.cursor = 'nwse-resize';
        });
        
        resizeHandle.on('mouseleave', () => {
            if (!isResizing) {
                document.body.style.cursor = 'default';
            }
        });
        
        group.on('dragend', () => {
            const decoration = this.currentTree.data.decorations.find(d => d.id === data.id);
            if (decoration) {
                decoration.x = group.x();
                decoration.y = group.y();
                this.markUnsaved();
            }
        });
        
        group.on('click', (e) => {
            if (e.target.name() !== 'resizeHandle') {
                this.selectDecoration(group, data);
            }
        });
        
        this.layer.add(group);
        this.layer.draw();
    }
    
    updatePersonCard(group, data) {
        // Remove all text elements from the group
        const children = group.getChildren();
        children.forEach(child => {
            if (child.getClassName() === 'Text') {
                child.destroy();
            }
        });
        
        // Update card height based on content
        let cardHeight = 220;
        if (data.deathDate) cardHeight += 15;
        if (data.burialLocation) cardHeight += 15;
        
        const card = group.findOne('Rect');
        if (card && card.fill() === 'white') {
            card.height(cardHeight);
        }
        
        // Re-add text elements with updated data
        const nameText = new Konva.Text({
            x: 10,
            y: 115,
            width: 160,
            text: data.name,
            fontSize: 16,
            fontFamily: 'Arial',
            fontStyle: 'bold',
            fill: '#333',
            align: 'center',
            wrap: 'word'
        });
        group.add(nameText);
        
        let yPos = 140;
        
        const birthText = new Konva.Text({
            x: 10,
            y: yPos,
            width: 160,
            text: `Birth: ${data.birthDate || 'N/A'}`,
            fontSize: 11,
            fontFamily: 'Arial',
            fill: '#555',
            align: 'left'
        });
        group.add(birthText);
        yPos += 15;
        
        // Birth location - always show
        const birthLocText = new Konva.Text({
            x: 10,
            y: yPos,
            width: 160,
            text: data.birthLocation || '',
            fontSize: 10,
            fontFamily: 'Arial',
            fill: '#777',
            align: 'left',
            wrap: 'word'
        });
        group.add(birthLocText);
        yPos += 15;
        
        // Death info - show if date exists
        if (data.deathDate) {
            yPos += 5;
            const deathText = new Konva.Text({
                x: 10,
                y: yPos,
                width: 160,
                text: `Death: ${data.deathDate}`,
                fontSize: 11,
                fontFamily: 'Arial',
                fill: '#555',
                align: 'left'
            });
            group.add(deathText);
            yPos += 15;
            
            const burialText = new Konva.Text({
                x: 10,
                y: yPos,
                width: 160,
                text: `Burial: ${data.burialLocation || ''}`,
                fontSize: 10,
                fontFamily: 'Arial',
                fill: '#777',
                align: 'left',
                wrap: 'word'
            });
            group.add(burialText);
        }
        
        this.layer.draw();
    }
    
    selectNode(group, data) {
        this.deselectAll();
        
        // Highlight selection
        const card = group.findOne('Rect');
        card.stroke('#ff6b6b');
        card.strokeWidth(3);
        this.layer.draw();
        
        // Show properties panel
        const propertiesContent = document.getElementById('propertiesContent');
        propertiesContent.innerHTML = `
            <div class="property-group">
                <label>Name</label>
                <input type="text" id="propName" value="${data.name}">
            </div>
            <div class="property-group">
                <label>Birth Date</label>
                <input type="text" id="propBirthDate" value="${data.birthDate || ''}" placeholder="e.g., Jan 1, 1950">
            </div>
            <div class="property-group">
                <label>Birth Location</label>
                <input type="text" id="propBirthLocation" value="${data.birthLocation || ''}" placeholder="e.g., New York, NY">
            </div>
            <div class="property-group">
                <label>Death Date</label>
                <input type="text" id="propDeathDate" value="${data.deathDate || ''}" placeholder="e.g., Dec 31, 2020">
            </div>
            <div class="property-group">
                <label>Burial Location</label>
                <input type="text" id="propBurialLocation" value="${data.burialLocation || ''}" placeholder="e.g., Memorial Park">
            </div>
            <div class="property-group">
                <label>Photo</label>
                <button class="btn" id="uploadPhotoBtn">Upload Photo</button>
            </div>
            <div class="property-group">
                <button class="btn btn-danger" id="deleteNodeBtn">Delete Person</button>
            </div>
        `;
        
        document.getElementById('propName').addEventListener('input', (e) => {
            data.name = e.target.value;
            this.updatePersonCard(group, data);
            this.markUnsaved();
        });
        
        document.getElementById('propBirthDate').addEventListener('input', (e) => {
            data.birthDate = e.target.value;
            this.updatePersonCard(group, data);
            this.markUnsaved();
        });
        
        document.getElementById('propBirthLocation').addEventListener('input', (e) => {
            data.birthLocation = e.target.value;
            this.updatePersonCard(group, data);
            this.markUnsaved();
        });
        
        document.getElementById('propDeathDate').addEventListener('input', (e) => {
            data.deathDate = e.target.value;
            this.updatePersonCard(group, data);
            this.markUnsaved();
        });
        
        document.getElementById('propBurialLocation').addEventListener('input', (e) => {
            data.burialLocation = e.target.value;
            this.updatePersonCard(group, data);
            this.markUnsaved();
        });
        
        document.getElementById('uploadPhotoBtn').addEventListener('click', () => {
            this.currentUploadNodeId = data.id;
            document.getElementById('photoUpload').click();
        });
        
        document.getElementById('deleteNodeBtn').addEventListener('click', () => {
            if (confirm('Delete this person?')) {
                this.deleteNode(data.id);
            }
        });
    }
    
    selectLine(line, data) {
        this.deselectAll();
        
        // Highlight selected line
        line.stroke('#ff6b6b');
        line.strokeWidth(4);
        this.layer.draw();
        
        const propertiesContent = document.getElementById('propertiesContent');
        propertiesContent.innerHTML = `
            <div class="property-group">
                <label>Line Style</label>
                <select id="propLineStyle" class="property-select">
                    <option value="solid" ${data.lineStyle === 'solid' ? 'selected' : ''}>Solid</option>
                    <option value="dashed" ${data.lineStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                </select>
            </div>
            <div class="property-group">
                <button class="btn btn-danger" id="deleteLineBtn">Delete Line</button>
            </div>
        `;
        
        document.getElementById('propLineStyle').addEventListener('change', (e) => {
            data.lineStyle = e.target.value;
            
            // Update line appearance
            if (e.target.value === 'dashed') {
                line.dash([10, 5]);
            } else {
                line.dash([]);
            }
            line.setAttr('lineStyle', e.target.value);
            this.layer.draw();
            this.markUnsaved();
        });
        
        document.getElementById('deleteLineBtn').addEventListener('click', () => {
            if (confirm('Delete this connection?')) {
                this.deleteLine(data.id);
            }
        });
    }
    
    selectDecoration(shape, data) {
        this.deselectAll();
        
        const propertiesContent = document.getElementById('propertiesContent');
        
        if (data.type === 'note') {
            propertiesContent.innerHTML = `
                <div class="property-group">
                    <label>Note Text</label>
                    <textarea id="propNoteText">${data.text}</textarea>
                </div>
                <div class="property-group">
                    <button class="btn btn-danger" id="deleteDecoBtn">Delete Note</button>
                </div>
            `;
            
            document.getElementById('propNoteText').addEventListener('input', (e) => {
                data.text = e.target.value;
                const text = shape.findOne('Text');
                if (text) {
                    text.text(e.target.value);
                    this.layer.draw();
                }
                this.markUnsaved();
            });
        } else if (data.type === 'emoji') {
            propertiesContent.innerHTML = `
                <div class="property-group">
                    <label>Emoji: ${data.emoji}</label>
                </div>
                <div class="property-group">
                    <button class="btn btn-danger" id="deleteDecoBtn">Delete Emoji</button>
                </div>
            `;
        } else {
            const typeLabel = data.type;
            propertiesContent.innerHTML = `
                <div class="property-group">
                    <button class="btn btn-danger" id="deleteDecoBtn">Delete ${typeLabel}</button>
                </div>
            `;
        }
        
        document.getElementById('deleteDecoBtn').addEventListener('click', () => {
            const typeLabel = data.type === 'emoji' ? 'emoji' : data.type === 'note' ? 'note' : data.type;
            if (confirm(`Delete this ${typeLabel}?`)) {
                this.deleteDecoration(data.id);
            }
        });
    }
    
    deselectAll() {
        // Reset all person card strokes
        this.layer.find('Group').forEach(group => {
            const card = group.findOne('Rect');
            if (card && card.stroke() === '#ff6b6b') {
                card.stroke('#4a90e2');
                card.strokeWidth(2);
            }
        });
        
        // Reset all line strokes
        this.layer.find('Line').forEach(line => {
            if (line.stroke() === '#ff6b6b') {
                line.stroke('#666');
                line.strokeWidth(3);
            }
        });
        
        this.layer.draw();
        
        document.getElementById('propertiesContent').innerHTML = 
            '<p class="no-selection">Select an item to edit its properties</p>';
    }
    
    async handlePhotoUpload(event) {
        const file = event.target.files[0];
        if (!file || !this.currentUploadNodeId) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`/api/trees/${this.currentTree.id}/upload`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            // Update node data
            const node = this.currentTree.data.nodes.find(n => n.id === this.currentUploadNodeId);
            if (node) {
                node.photo = result.url;
                
                // Redraw the person card
                const group = this.stage.findOne('#' + this.currentUploadNodeId);
                if (group) {
                    group.destroy();
                    this.createPersonFromData(node);
                    this.layer.draw();
                }
                
                this.markUnsaved();
                this.updateSaveStatus('Photo uploaded');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload photo');
        }
        
        event.target.value = '';
    }
    
    deleteNode(nodeId) {
        // Remove from data
        this.currentTree.data.nodes = this.currentTree.data.nodes.filter(n => n.id !== nodeId);
        
        // Remove connected edges
        this.currentTree.data.edges = this.currentTree.data.edges.filter(
            e => e.from !== nodeId && e.to !== nodeId
        );
        
        // Remove from canvas
        const node = this.stage.findOne('#' + nodeId);
        if (node) node.destroy();
        
        // Remove connected lines
        this.layer.find('Line').forEach(line => {
            if (line.getAttr('fromNode') === nodeId || line.getAttr('toNode') === nodeId) {
                line.destroy();
            }
        });
        
        this.layer.draw();
        this.deselectAll();
        this.markUnsaved();
    }
    
    deleteDecoration(decorationId) {
        this.currentTree.data.decorations = this.currentTree.data.decorations.filter(
            d => d.id !== decorationId
        );
        
        const decoration = this.stage.findOne('#' + decorationId);
        if (decoration) decoration.destroy();
        
        this.layer.draw();
        this.deselectAll();
        this.markUnsaved();
    }
    
    deleteLine(lineId) {
        // Remove from data
        this.currentTree.data.edges = this.currentTree.data.edges.filter(
            e => e.id !== lineId
        );
        
        // Remove from canvas
        const line = this.stage.findOne('#' + lineId);
        if (line) line.destroy();
        
        this.layer.draw();
        this.deselectAll();
        this.markUnsaved();
    }
    
    async saveTree() {
        if (!this.currentTree) return;
        
        // Update positions for all nodes
        this.currentTree.data.nodes.forEach(node => {
            const group = this.stage.findOne('#' + node.id);
            if (group) {
                node.x = group.x();
                node.y = group.y();
            }
        });
        
        try {
            await fetch(`/api/trees/${this.currentTree.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: this.currentTree.name,
                    data: this.currentTree.data
                })
            });
            
            this.unsavedChanges = false;
            this.updateSaveStatus('Saved');
            await this.loadTrees(); // Refresh tree list
        } catch (error) {
            console.error('Failed to save tree:', error);
            alert('Failed to save tree');
        }
    }
    
    async deleteTree() {
        if (!this.currentTree) return;
        
        if (!confirm(`Delete "${this.currentTree.name}"? This cannot be undone.`)) return;
        
        try {
            await fetch(`/api/trees/${this.currentTree.id}`, {
                method: 'DELETE'
            });
            
            this.currentTree = null;
            this.layer.destroyChildren();
            this.layer.draw();
            
            document.getElementById('canvas').style.display = 'none';
            document.getElementById('noTreeMessage').style.display = 'flex';
            document.getElementById('currentTreeName').textContent = 'No tree selected';
            
            await this.loadTrees();
            this.updateSaveStatus('Tree deleted');
        } catch (error) {
            console.error('Failed to delete tree:', error);
            alert('Failed to delete tree');
        }
    }
    
    markUnsaved() {
        this.unsavedChanges = true;
        this.updateSaveStatus('Unsaved changes');
        
        // Debounce: only trigger auto-save after 2 seconds of no changes
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            if (this.currentTree && this.unsavedChanges) {
                this.saveTree();
            }
        }, 2000);
    }
    
    updateSaveStatus(message) {
        document.getElementById('saveStatus').textContent = message;
        
        if (message) {
            setTimeout(() => {
                if (document.getElementById('saveStatus').textContent === message) {
                    document.getElementById('saveStatus').textContent = '';
                }
            }, 3000);
        }
    }
    
    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            if (this.currentTree && this.unsavedChanges) {
                console.log('Auto-saving...');
                this.saveTree();
            }
        }, 15000); // 15 seconds
    }
    
    zoomIn() {
        const oldScale = this.stage.scaleX();
        const newScale = oldScale * 1.2;
        if (newScale > 3) return;
        
        const center = {
            x: this.stage.width() / 2,
            y: this.stage.height() / 2
        };
        
        const mousePointTo = {
            x: (center.x - this.stage.x()) / oldScale,
            y: (center.y - this.stage.y()) / oldScale
        };
        
        this.stage.scale({ x: newScale, y: newScale });
        
        const newPos = {
            x: center.x - mousePointTo.x * newScale,
            y: center.y - mousePointTo.y * newScale
        };
        
        this.stage.position(newPos);
        this.stage.batchDraw();
    }
    
    zoomOut() {
        const oldScale = this.stage.scaleX();
        const newScale = oldScale / 1.2;
        if (newScale < 0.3) return;
        
        const center = {
            x: this.stage.width() / 2,
            y: this.stage.height() / 2
        };
        
        const mousePointTo = {
            x: (center.x - this.stage.x()) / oldScale,
            y: (center.y - this.stage.y()) / oldScale
        };
        
        this.stage.scale({ x: newScale, y: newScale });
        
        const newPos = {
            x: center.x - mousePointTo.x * newScale,
            y: center.y - mousePointTo.y * newScale
        };
        
        this.stage.position(newPos);
        this.stage.batchDraw();
    }
    
    resetZoom() {
        this.stage.scale({ x: 1, y: 1 });
        this.stage.position({ x: 0, y: 0 });
        this.stage.batchDraw();
    }
    
    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        
        // Update button text
        const btn = document.getElementById('darkModeToggle');
        btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        
        // Save preference
        localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
        
        // Update stage background
        if (this.stage) {
            this.stage.container().style.background = isDark ? '#1a1a1a' : '#fafafa';
        }
    }
    
    loadDarkMode() {
        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'enabled') {
            document.body.classList.add('dark-mode');
            const btn = document.getElementById('darkModeToggle');
            btn.textContent = '☀️ Light Mode';
            if (this.stage) {
                this.stage.container().style.background = '#1a1a1a';
            }
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FamilyTreeApp();
});
