# 🐟 Backend - Gestion de Poissonnerie (Saad Poisson)

API REST complète pour la gestion d'une poissonnerie, incluant la gestion des produits, clients, fournisseurs, ventes, factures, dépenses, employés et rapports.

## 📋 Table des matières

- [Fonctionnalités](#fonctionnalités)
- [Technologies utilisées](#technologies-utilisées)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Structure du projet](#structure-du-projet)
- [Routes API](#routes-api)
- [Modèles de données](#modèles-de-données)
- [Sécurité](#sécurité)
- [Déploiement](#déploiement)

## ✨ Fonctionnalités

### Gestion des utilisateurs
- ✅ Authentification avec JWT
- ✅ Gestion des rôles (Admin, Manager, Vendeur)
- ✅ Mot de passe chiffré avec bcrypt

### Gestion des produits
- 📦 CRUD complet des produits
- 📊 Gestion du stock en temps réel
- 📈 Historique des mouvements de stock
- ⚠️ Alertes de stock bas

### Gestion des ventes
- 💰 Création et suivi des ventes
- 🧾 Génération de factures PDF
- 💳 Gestion des paiements
- 📋 Historique des transactions

### Gestion des clients & fournisseurs
- 👥 Gestion complète des clients
- 🏢 Gestion des fournisseurs
- 📞 Coordonnées et historique
- 💼 Suivi des dettes et crédits

### Gestion financière
- 💸 Suivi des dépenses
- 📊 Rapports financiers détaillés
- 📈 Statistiques et analyses
- 📑 Export des rapports (PDF, CSV, DOCX)

### Gestion des employés
- 👨‍💼 Gestion du personnel
- 💵 Gestion des salaires
- 📅 Historique des paiements
- 📊 Suivi des performances

### Système de notifications
- 🔔 Notifications en temps réel
- ⚠️ Alertes personnalisées
- 📧 Notifications par type (stock, paiement, etc.)

## 🛠️ Technologies utilisées

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **MongoDB** - Base de données NoSQL
- **Mongoose** - ODM pour MongoDB
- **JWT** - Authentification par tokens
- **bcryptjs** - Chiffrement des mots de passe
- **PDFKit** - Génération de PDF
- **CSV-Writer** - Export CSV
- **DOCX** - Export Word
- **Helmet** - Sécurité des en-têtes HTTP
- **Morgan** - Logger HTTP
- **CORS** - Gestion des origines croisées
- **Express-Validator** - Validation des données

## 📦 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- [Node.js](https://nodejs.org/) (version 16 ou supérieure)
- [MongoDB](https://www.mongodb.com/) (version 5 ou supérieure)
- [npm](https://www.npmjs.com/) ou [yarn](https://yarnpkg.com/)

## 🚀 Installation

1. **Cloner le repository**

```bash
git clone <url-du-repo>
cd backend
```

2. **Installer les dépendances**

```bash
npm install
```

## ⚙️ Configuration

1. **Créer le fichier `.env`**

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```env
# Serveur
PORT=5000
NODE_ENV=development

# Base de données MongoDB
MONGO_URI=mongodb://localhost:27017/poissonnerie
# ou pour MongoDB Atlas
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/poissonnerie

# JWT Secret (utilisez une clé forte en production)
JWT_SECRET=votre_cle_secrete_tres_forte_et_aleatoire

# JWT Expiration
JWT_EXPIRE=30d

# CORS Origins (facultatif, à ajuster selon vos besoins)
CORS_ORIGIN=http://localhost:5173
```

2. **Sécuriser les variables d'environnement**

⚠️ **Important** : Ne jamais commiter le fichier `.env` dans Git. Il est déjà inclus dans `.gitignore`.

## 🏃 Démarrage

### Mode développement (avec nodemon)

```bash
npm run dev
```

### Mode production

```bash
npm start
```

Le serveur démarre sur `http://localhost:5000` (ou le port défini dans `.env`)

## 📁 Structure du projet

```
backend/
├── src/
│   ├── assets/           # Ressources statiques
│   │   └── icons/        # Icônes pour les PDF
│   ├── config/           # Configuration
│   │   └── db.js         # Connexion MongoDB
│   ├── controllers/      # Logique métier
│   │   ├── authController.js
│   │   ├── clientController.js
│   │   ├── damageController.js
│   │   ├── employeeController.js
│   │   ├── expenseController.js
│   │   ├── invoiceController.js
│   │   ├── notificationsController.js 
│   │   ├── productController.js
│   │   ├── reportController.js
│   │   ├── saleController.js
│   │   ├── settingsController.js
│   │   ├── supplierController.js
│   │   └── systemConfigController.js
│   ├── middlewares/      # Middlewares
│   │   ├── authMiddleware.js
│   │   └── errorMiddleware.js
│   ├── models/           # Modèles Mongoose
│   │   ├── Client.js
│   │   ├── Damage.js
│   │   ├── Employee.js
│   │   ├── Expense.js
│   │   ├── Invoice.js
│   │   ├── Notification.js
│   │   ├── Product.js
│   │   ├── SalaryPayment.js
│   │   ├── Sale.js
│   │   ├── Settings.js
│   │   ├── StockMovement.js
│   │   ├── Supplier.js
│   │   ├── SystemConfig.js
│   │   └── User.js
│   ├── routes/           # Routes Express
│   │   ├── authRoutes.js
│   │   ├── clientRoutes.js
│   │   ├── damageRoutes.js
│   │   ├── employeeRoutes.js
│   │   ├── expenseRoutes.js
│   │   ├── invoiceRoutes.js
│   │   ├── notificationsRoutes.js
│   │   ├── productRoutes.js
│   │   ├── reportRoutes.js
│   │   ├── saleRoutes.js
│   │   ├── settingsRoutes.js
│   │   ├── supplierRoutes.js
│   │   └── systemConfigRoutes.js
│   ├── utils/            # Utilitaires
│   │   ├── exportReport.js
│   │   ├── generateInvoicePDF.js
│   │   └── notify.js
│   └── app.js            # Configuration Express
├── .env                  # Variables d'environnement (non versionné)
├── .gitignore            # Fichiers ignorés par Git
├── package.json          # Dépendances et scripts
├── server.js             # Point d'entrée de l'application
└── README.md             # Documentation
```

## 🌐 Routes API

### Authentification (`/api/auth`)
```
POST   /api/auth/register          - Créer un utilisateur
POST   /api/auth/login             - Se connecter
GET    /api/auth/profile           - Obtenir le profil (protégé)
PUT    /api/auth/profile           - Mettre à jour le profil (protégé)
```

### Produits (`/api/products`)
```
GET    /api/products               - Liste des produits
GET    /api/products/:id           - Détails d'un produit
POST   /api/products               - Créer un produit (protégé)
PUT    /api/products/:id           - Modifier un produit (protégé)
DELETE /api/products/:id           - Supprimer un produit (protégé)
GET    /api/products/low-stock     - Produits en stock bas (protégé)
```

### Clients (`/api/clients`)
```
GET    /api/clients                - Liste des clients
GET    /api/clients/:id            - Détails d'un client
POST   /api/clients                - Créer un client (protégé)
PUT    /api/clients/:id            - Modifier un client (protégé)
DELETE /api/clients/:id            - Supprimer un client (protégé)
```

### Fournisseurs (`/api/suppliers`)
```
GET    /api/suppliers              - Liste des fournisseurs
GET    /api/suppliers/:id          - Détails d'un fournisseur
POST   /api/suppliers              - Créer un fournisseur (protégé)
PUT    /api/suppliers/:id          - Modifier un fournisseur (protégé)
DELETE /api/suppliers/:id          - Supprimer un fournisseur (protégé)
```

### Ventes (`/api/sales`)
```
GET    /api/sales                  - Liste des ventes
GET    /api/sales/:id              - Détails d'une vente
POST   /api/sales                  - Créer une vente (protégé)
PUT    /api/sales/:id              - Modifier une vente (protégé)
DELETE /api/sales/:id              - Supprimer une vente (protégé)
GET    /api/sales/stats            - Statistiques des ventes (protégé)
```

### Factures (`/api/invoices`)
```
GET    /api/invoices               - Liste des factures
GET    /api/invoices/:id           - Détails d'une facture
POST   /api/invoices               - Créer une facture (protégé)
GET    /api/invoices/:id/pdf       - Générer PDF (protégé)
PUT    /api/invoices/:id/pay       - Marquer comme payée (protégé)
```

### Dépenses (`/api/expenses`)
```
GET    /api/expenses               - Liste des dépenses
GET    /api/expenses/:id           - Détails d'une dépense
POST   /api/expenses               - Créer une dépense (protégé)
PUT    /api/expenses/:id           - Modifier une dépense (protégé)
DELETE /api/expenses/:id           - Supprimer une dépense (protégé)
```

### Rapports (`/api/reports`)
```
GET    /api/reports/sales          - Rapport des ventes (protégé)
GET    /api/reports/financial      - Rapport financier (protégé)
GET    /api/reports/stock          - Rapport de stock (protégé)
GET    /api/reports/export/:type   - Exporter rapport (PDF/CSV/DOCX) (protégé)
```

### Employés (`/api/employees`)
```
GET    /api/employees              - Liste des employés
GET    /api/employees/:id          - Détails d'un employé
POST   /api/employees              - Créer un employé (protégé)
PUT    /api/employees/:id          - Modifier un employé (protégé)
DELETE /api/employees/:id          - Supprimer un employé (protégé)
POST   /api/employees/:id/salary   - Payer un salaire (protégé)
```

### Notifications (`/api/notifications`)
```
GET    /api/notifications          - Liste des notifications (protégé)
PUT    /api/notifications/:id/read - Marquer comme lue (protégé)
DELETE /api/notifications/:id      - Supprimer (protégé)
```

### Configuration système (`/api/system`)
```
GET    /api/system/config          - Obtenir la configuration (protégé)
PUT    /api/system/config          - Mettre à jour la config (admin)
```

### Paramètres (`/api/settings`)
```
GET    /api/settings               - Obtenir les paramètres (protégé)
PUT    /api/settings               - Mettre à jour les paramètres (protégé)
```

### Dommages (`/api/damages`)
```
GET    /api/damages                - Liste des dommages
POST   /api/damages                - Déclarer un dommage (protégé)
PUT    /api/damages/:id            - Modifier un dommage (protégé)
DELETE /api/damages/:id            - Supprimer un dommage (protégé)
```

## 🗄️ Modèles de données

### User
- Gestion des utilisateurs avec rôles (admin, manager, vendeur)
- Authentification par email/mot de passe

### Product
- Informations produit (nom, prix, stock, catégorie)
- Suivi du stock minimum
- Images et descriptions

### Client
- Informations client (nom, contact, adresse)
- Historique des achats
- Gestion des dettes

### Supplier
- Informations fournisseur
- Historique des commandes
- Coordonnées bancaires

### Sale
- Ventes avec items multiples
- Gestion du paiement
- Statut de la vente

### Invoice
- Factures liées aux ventes
- Génération PDF automatique
- Suivi des paiements

### Expense
- Dépenses avec catégories
- Pièces justificatives
- Date et montant

### Employee
- Informations employé
- Poste et salaire
- Date d'embauche

### Notification
- Notifications système
- Types personnalisés
- Statut lu/non lu

## 🔒 Sécurité

### Mesures de sécurité implémentées

- ✅ **Authentification JWT** - Tokens sécurisés pour l'authentification
- ✅ **Bcrypt** - Hachage des mots de passe avec salt
- ✅ **Helmet** - Protection des en-têtes HTTP
- ✅ **CORS** - Configuration stricte des origines autorisées
- ✅ **Express-Validator** - Validation et sanitisation des entrées
- ✅ **Variables d'environnement** - Secrets stockés hors du code
- ✅ **Rate limiting** - Protection contre les attaques par force brute (à implémenter)
- ✅ **Middleware d'autorisation** - Contrôle d'accès basé sur les rôles

### Bonnes pratiques

- Ne jamais exposer les secrets dans le code
- Utiliser HTTPS en production
- Garder les dépendances à jour
- Logger les tentatives d'accès non autorisées
- Valider toutes les entrées utilisateur

## 🚀 Déploiement

### Prérequis production

1. **Base de données MongoDB**
   - Utiliser MongoDB Atlas ou un serveur MongoDB dédié
   - Configurer les backups automatiques

2. **Variables d'environnement**
   - Définir `NODE_ENV=production`
   - Utiliser un `JWT_SECRET` fort et unique
   - Configurer les CORS origins de production

3. **Serveur**
   - Utiliser un gestionnaire de processus (PM2, systemd)
   - Configurer un reverse proxy (Nginx, Apache)
   - Activer HTTPS avec Let's Encrypt

### Exemple avec PM2

```bash
# Installer PM2
npm install -g pm2

# Démarrer l'application
pm2 start server.js --name "poissonnerie-api"

# Configuration auto-restart
pm2 startup
pm2 save
```

### Exemple avec Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name api.saadpoisson.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📝 Scripts disponibles

```bash
npm start       # Démarrer le serveur en mode production
npm run dev     # Démarrer en mode développement avec nodemon
```

## 📄 Licence

Ce projet est sous licence ISC.

## 👨‍💻 Auteur

Développé par Abdoul Razzaï Barry et Boubacar Bah pour Saad_Poisson

## 🆘 Support

Pour toute question ou problème :
- Contacter l'équipe de développement