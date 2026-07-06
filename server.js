const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors =	require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// app.use(express.static(path.join(__dirname, '.'))); // Removido - frontend está no Netlify

// Database setup
const db = new sqlite3.Database('./jejezin.db', (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT DEFAULT 'https://via.placeholder.com/100',
        cover TEXT DEFAULT 'https://via.placeholder.com/300x100',
        bio TEXT DEFAULT '',
        followers INTEGER DEFAULT 0,
        following INTEGER DEFAULT 0,
        posts INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Erro ao criar tabela users:', err.message);
        } else {
            console.log('Tabela users criada com sucesso');
        }
    });

    // Create posts table
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        content TEXT,
        image_url TEXT,
        video_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        likes INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`, (err) => {
        if (err) {
            console.error('Erro ao criar tabela posts:', err.message);
        } else {
            console.log('Tabela posts criada com sucesso');
        }
    });

    // Create followers table
    db.run(`CREATE TABLE IF NOT EXISTS followers (
        follower_id INTEGER NOT NULL,
        following_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (follower_id, following_id),
        FOREIGN KEY (follower_id) REFERENCES users(id),
        FOREIGN KEY (following_id) REFERENCES users(id)
    )`, (err) => {
        if (err) {
            console.error('Erro ao criar tabela followers:', err.message);
        } else {
            console.log('Tabela followers criada com sucesso');
        }
    });

    // Create messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
    )`, (err) => {
        if (err) {
            console.error('Erro ao criar tabela messages:', err.message);
        } else {
            console.log('Tabela messages criada com sucesso');
        }
    });
}

// API Routes

// Get all users
app.get('/api/users', (req, res) => {
    db.all('SELECT * FROM users ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get user by ID
app.get('/api/users/:id', (req, res) => {
    db.get('SELECT * FROM users WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Usuário não encontrado' });
            return;
        }
        res.json(row);
    });
});

// Create user
app.post('/api/users', (req, res) => {
    const { name, username, email, password } = req.body;
    
    if (!name || !username || !email || !password) {
        res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        return;
    }

    const usernameWithAt = username.startsWith('@') ? username : '@' + username;

    db.run(
        'INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)',
        [name, usernameWithAt, email, password],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: 'Username ou email já existe' });
                } else {
                    res.status(500).json({ error: err.message });
                }
                return;
            }
            res.json({ id: this.lastID, name, username: usernameWithAt, email, password });
        }
    );
});

// Update user
app.put('/api/users/:id', (req, res) => {
    const { name, username, email, password, avatar, cover, bio, followers, following, posts } = req.body;
    
    db.run(
        'UPDATE users SET name = ?, username = ?, email = ?, password = ?, avatar = ?, cover = ?, bio = ?, followers = ?, following = ?, posts = ? WHERE id = ?',
        [name, username, email, password, avatar, cover, bio, followers, following, posts, req.params.id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Usuário atualizado com sucesso' });
        }
    );
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Usuário deletado com sucesso' });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(401).json({ error: 'Email ou senha incorretos' });
            return;
        }
        res.json(row);
    });
});

// Get posts
app.get('/api/posts', (req, res) => {
    db.all(`
        SELECT p.*, u.name, u.username, u.avatar 
        FROM posts p 
        JOIN users u ON p.user_id = u.id 
        ORDER BY p.created_at DESC
    `, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create post
app.post('/api/posts', (req, res) => {
    const { user_id, content, image_url, video_url } = req.body;
    
    db.run(
        'INSERT INTO posts (user_id, content, image_url, video_url) VALUES (?, ?, ?, ?)',
        [user_id, content, image_url, video_url],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Update user post count
            db.run('UPDATE users SET posts = posts + 1 WHERE id = ?', [user_id]);
            
            res.json({ id: this.lastID });
        }
    );
});

// Follow user
app.post('/api/follow', (req, res) => {
    const { follower_id, following_id } = req.body;
    
    db.run(
        'INSERT INTO followers (follower_id, following_id) VALUES (?, ?)',
        [follower_id, following_id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Update follower counts
            db.run('UPDATE users SET following = following + 1 WHERE id = ?', [follower_id]);
            db.run('UPDATE users SET followers = followers + 1 WHERE id = ?', [following_id]);
            
            res.json({ message: 'Seguindo com sucesso' });
        }
    );
});

// Unfollow user
app.delete('/api/follow', (req, res) => {
    const { follower_id, following_id } = req.query;
    
    db.run(
        'DELETE FROM followers WHERE follower_id = ? AND following_id = ?',
        [follower_id, following_id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Update follower counts
            db.run('UPDATE users SET following = following - 1 WHERE id = ?', [follower_id]);
            db.run('UPDATE users SET followers = followers - 1 WHERE id = ?', [following_id]);
            
            res.json({ message: 'Deixou de seguir com sucesso' });
        }
    );
});

// Get followers
app.get('/api/followers/:userId', (req, res) => {
    db.all(`
        SELECT u.* FROM users u
        JOIN followers f ON u.id = f.follower_id
        WHERE f.following_id = ?
    `, [req.params.userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get following
app.get('/api/following/:userId', (req, res) => {
    db.all(`
        SELECT u.* FROM users u
        JOIN followers f ON u.id = f.following_id
        WHERE f.follower_id = ?
    `, [req.params.userId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Check if following
app.get('/api/is-following', (req, res) => {
    const { follower_id, following_id } = req.query;
    
    db.get(
        'SELECT * FROM followers WHERE follower_id = ? AND following_id = ?',
        [follower_id, following_id],
        (err, row) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ isFollowing: !!row });
        }
    );
});

// Get messages between users
app.get('/api/messages', (req, res) => {
    const { user1_id, user2_id } = req.query;
    
    db.all(`
        SELECT m.*, u.name as sender_name, u.username as sender_username, u.avatar as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
    `, [user1_id, user2_id, user2_id, user1_id], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Send message
app.post('/api/messages', (req, res) => {
    const { sender_id, receiver_id, text } = req.body;
    
    db.run(
        'INSERT INTO messages (sender_id, receiver_id, text) VALUES (?, ?, ?)',
        [sender_id, receiver_id, text],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Para acessar de outros dispositivos, use o IP da máquina: http://SEU_IP:${PORT}`);
});
