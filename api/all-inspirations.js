const { INSPIRATIONS } = require('./_data');

module.exports = (req, res) => {
    res.status(200).json(INSPIRATIONS);
};
