const Sale = require('../models/Sale');
const Client = require('../models/Client');

/**
 * 🔧 CALCUL ROBUSTE DE LA DETTE D'UN CLIENT
 * Calcule la dette réelle en se basant sur les ventes à crédit
 * 
 * @param {String} clientId - ID du client
 * @returns {Object} { totalDebt, creditSales, totalCredit, totalPaid }
 */
const calculateClientDebt = async (clientId) => {
  try {
    // Récupérer toutes les ventes à crédit du client
    const creditSales = await Sale.find({
      client: clientId,
      paymentType: 'credit'
    }).sort({ createdAt: 1 });

    // Calculs
    const totalCredit = creditSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalPaid = creditSales.reduce((sum, sale) => sum + sale.amountPaid, 0);
    const totalDebt = creditSales.reduce((sum, sale) => sum + sale.remainingAmount, 0);

    return {
      totalDebt,      // Dette totale actuelle
      creditSales,    // Liste des ventes à crédit
      totalCredit,    // Montant total de crédit accordé
      totalPaid,      // Montant total déjà payé
      salesCount: creditSales.length
    };
  } catch (error) {
    throw new Error(`Erreur calcul dette: ${error.message}`);
  }
};

/**
 * 🔄 SYNCHRONISER LA DETTE DU CLIENT
 * Met à jour client.currentDebt avec la valeur réelle calculée
 * 
 * @param {String} clientId - ID du client
 * @returns {Object} { client, oldDebt, newDebt, difference }
 */
const syncClientDebt = async (clientId) => {
  try {
    const client = await Client.findById(clientId);
    if (!client) throw new Error('Client introuvable');

    const oldDebt = client.currentDebt;
    const { totalDebt } = await calculateClientDebt(clientId);

    client.currentDebt = totalDebt;
    client.isBlocked = client.creditLimit > 0 && client.currentDebt >= client.creditLimit;
    await client.save();

    return {
      client,
      oldDebt,
      newDebt: totalDebt,
      difference: totalDebt - oldDebt,
      wasDesynchronized: Math.abs(totalDebt - oldDebt) > 0.01 // Tolérance 1 centime
    };
  } catch (error) {
    throw new Error(`Erreur sync dette: ${error.message}`);
  }
};

/**
 * 💰 DISTRIBUER UN PAIEMENT SUR LES VENTES À CRÉDIT
 * Applique un paiement aux ventes les plus anciennes en premier (FIFO)
 * 
 * @param {String} clientId - ID du client
 * @param {Number} paymentAmount - Montant du paiement
 * @param {ObjectId} userId - ID de l'utilisateur qui enregistre
 * @returns {Object} { allocations, salesUpdated, remainingPayment }
 */
const allocatePaymentToSales = async (clientId, paymentAmount, userId = null) => {
  try {
    const creditSales = await Sale.find({
      client: clientId,
      paymentType: 'credit',
      remainingAmount: { $gt: 0 }
    }).sort({ createdAt: 1 }); // FIFO : les plus anciennes d'abord

    let remainingPayment = paymentAmount;
    const allocations = [];
    const salesUpdated = [];

    for (const sale of creditSales) {
      if (remainingPayment <= 0) break;

      const saleRemainingBefore = sale.remainingAmount;
      const amountToAllocate = Math.min(remainingPayment, sale.remainingAmount);

      // Mettre à jour la vente
      sale.amountPaid += amountToAllocate;
      sale.remainingAmount -= amountToAllocate;

      // Mettre à jour le statut
      if (sale.remainingAmount === 0) {
        sale.status = 'payé';
      } else if (sale.amountPaid > 0) {
        sale.status = 'partiel';
      }

      await sale.save();

      //Enregistrer l'allocation
      allocations.push({
        sale: sale._id,
        saleNumber: sale.saleNumber,
        amountAllocated: amountToAllocate,
        saleRemainingBefore,
        saleRemainingAfter: sale.remainingAmount
      });

      salesUpdated.push(sale);
      remainingPayment -= amountToAllocate;
    }

    return {
      allocations,
      salesUpdated,
      remainingPayment, // Devrait être 0 si tout s'est bien passé
      totalAllocated: paymentAmount - remainingPayment
    };
  } catch (error) {
    throw new Error(`Erreur allocation paiement: ${error.message}`);
  }
};

/**
 * 📊 VÉRIFIER LA COHÉRENCE DES DETTES
 * Compare client.currentDebt avec la somme des ventes
 * 
 * @param {String} clientId - ID du client (optionnel, vérifie tous si null)
 * @returns {Array} Liste des incohérences détectées
 */
const checkDebtConsistency = async (clientId = null) => {
  try {
    const filter = clientId ? { _id: clientId } : {};
    const clients = await Client.find(filter);
    const inconsistencies = [];

    for (const client of clients) {
      const { totalDebt } = await calculateClientDebt(client._id);
      const difference = Math.abs(client.currentDebt - totalDebt);

      if (difference > 0.01) { // Tolérance 1 centime
        inconsistencies.push({
          clientId: client._id,
          clientName: client.name,
          recordedDebt: client.currentDebt,
          calculatedDebt: totalDebt,
          difference: client.currentDebt - totalDebt
        });
      }
    }

    return inconsistencies;
  } catch (error) {
    throw new Error(`Erreur vérification cohérence: ${error.message}`);
  }
};

module.exports = {
  calculateClientDebt,
  syncClientDebt,
  allocatePaymentToSales,
  checkDebtConsistency
};
