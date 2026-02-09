
class StatusController {
  getStatus(req, res) {
    res.json({
      status: 'ok',
      service: 'auth-service-backend',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = StatusController;
