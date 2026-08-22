const notifier = require('node-notifier');
const open = require('open');

function notifyDeal(deal) {
  notifier.notify(
    {
      title: 'New deal on cheapies.nz',
      message: deal.title,
      wait: true,
      sound: true,
    },
    (err, response, metadata) => {
      if (!err && metadata && metadata.activationType === 'clicked' && deal.link) {
        open(deal.link);
      }
    }
  );
}

module.exports = { notifyDeal };
