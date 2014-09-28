var mongoose = require( 'mongoose' );
var log = require('./log')(module);
var config = require('./config');

mongoose.connect( config.get( 'mongoose:uri' ) );
var db = mongoose.connection;

db.on('error', function (err) {
    log.error('connection error:', err.message);
});
db.once('open', function callback () {
    log.info("Connected to DB!");
});

var Schema = mongoose.Schema;

var Stream = new Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    mime: { type: String, required: true },
    online: { type: Number, required: true }
});
var StreamModel = mongoose.model('Stream', Stream);
module.exports.StreamModel = StreamModel;
