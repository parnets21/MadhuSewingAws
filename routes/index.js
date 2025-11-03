const express = require('express');
const router = express.Router();

// Import all route files
const authRoutes = require('./authRoutes');
const productRoutes = require('./productRoutes');
const categoryRoutes = require('./categoryRoutes');
const brandRoutes = require('./BrandRoutes');
const bannerRoutes = require('./bannerRoutes');
const serviceRequestRoutes = require('./serviceRequestRoutes');
const reviewRoutes = require('./ReviewRoutes');
const content1Routes = require('./content1Routes');
const imageRoutes = require('./imageRoutes');
const adminRoutes = require('./adminRoutes');
const orderRoutes = require('./orderRoutes'); 
const jobRoutes = require('./jobRoutes');
const technicianRoutes = require('./technicianRoutes');
const salesRoutes = require('./SalesRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/brands', brandRoutes);
router.use('/banner', bannerRoutes);
router.use('/service-requests', serviceRequestRoutes);
router.use('/reviews', reviewRoutes);
router.use('/content1', content1Routes);
router.use('/images', imageRoutes);
router.use('/admin', adminRoutes);
router.use('/orders', orderRoutes);    
router.use('/jobs', jobRoutes);
router.use('/technicians', technicianRoutes);
router.use('/sales', salesRoutes);

module.exports = router;
