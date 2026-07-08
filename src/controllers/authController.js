const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

//===================Inscription==============\\
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//===================Connexion=================\\
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Ce compte est désactivé' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//===================Infos Profil connecté======\\
const getMe = async (req, res) => {
  res.json(req.user);
};

//===================Modifier mot de passe==========\\
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//=================Récuperer tous les utilisateurs=======\\
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//=================Mise à jour d'un utilisateur============\\
const updateUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//=================Activation-Desactivation d'un utilisateur============\\
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
    user.isActive = !user.isActive;
    await user.save();
    res.json({ message: `Utilisateur ${user.isActive ? 'activé' : 'désactivé'}`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//================Suppression d'un utilisateur===============\\
const deleteUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: 'Utilisateur introuvable' });

    // 🆕 VÉRIFICATION 1 : Empêcher l'admin de se supprimer lui-même
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    // 🆕 VÉRIFICATION 2 : Protéger le dernier admin
    if (targetUser.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({ 
          message: 'Impossible de supprimer le dernier administrateur actif du système'
        });
      }
    }

    // 🆕 VÉRIFICATION 3 : Vérifier l'historique d'activité
    const Sale = require('../models/Sale');
    const Invoice = require('../models/Invoice');
    const ClientPayment = require('../models/ClientPayment');
    
    const salesCount = await Sale.countDocuments({ recordedBy: targetUser._id });
    const invoicesCount = await Invoice.countDocuments({ issuedBy: targetUser._id });
    const paymentsCount = await ClientPayment.countDocuments({ paidBy: targetUser._id });
    
    const hasActivity = salesCount > 0 || invoicesCount > 0 || paymentsCount > 0;

    if (hasActivity) {
      // 🆕 Soft delete pour préserver la traçabilité
      targetUser.isActive = false;
      targetUser.name = `[DÉSACTIVÉ] ${targetUser.name}`;
      targetUser.email = `disabled_${Date.now()}_${targetUser.email}`; // Libérer l'email
      await targetUser.save();

      return res.json({ 
        message: 'Utilisateur désactivé avec succès (activité préservée)',
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          isActive: targetUser.isActive
        },
        archived: true,
        stats: {
          salesCount,
          invoicesCount,
          paymentsCount
        }
      });
    } else {
      // Hard delete si aucune activité (utilisateur jamais utilisé)
      await User.findByIdAndDelete(req.params.id);
      
      return res.json({ 
        message: 'Utilisateur supprimé définitivement (aucune activité)',
        deleted: true
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🆕 RÉACTIVER UN UTILISATEUR
const restoreUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    if (user.isActive) {
      return res.status(400).json({ message: 'Cet utilisateur est déjà actif' });
    }

    // Retirer le préfixe [DÉSACTIVÉ]
    if (user.name.startsWith('[DÉSACTIVÉ] ')) {
      user.name = user.name.replace('[DÉSACTIVÉ] ', '');
    }

    // Restaurer l'email (retirer le préfixe disabled_)
    if (user.email.startsWith('disabled_')) {
      user.email = user.email.split('_').slice(2).join('_');
    }

    user.isActive = true;
    await user.save();

    res.json({ 
      message: 'Utilisateur réactivé avec succès',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🆕 LISTER LES UTILISATEURS DÉSACTIVÉS
const getInactiveUsers = async (req, res) => {
  try {
    const inactiveUsers = await User.find({ isActive: false })
      .select('-password')
      .sort({ name: 1 });
    
    res.json(inactiveUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { 
  register, login, getMe, updatePassword, getUsers, updateUser, 
  toggleUserStatus, deleteUser, restoreUser, getInactiveUsers 
};
