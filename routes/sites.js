const { Router } = require('express');
const { listSites, createSite, deleteSite } = require('../controllers/sites');

const router = Router();

// Public: list all sites (used by QR-based DTR frontend)
router.get('/', listSites);

// Public for now: create new site / unit QR location
router.post('/', createSite);

// Public for now: delete a site by id
router.delete('/:id', deleteSite);

module.exports = router;

