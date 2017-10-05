'use strict';
var app = new (require('express'))();
var bodyParser = require('body-parser');
var sha256 = require('js-sha256');
var miner_address = 'peer2';
var other_address = 'peer1';
var port = 3001;
var request = require('request');

// class declaration comes first because it cannot be hoisted
class Block {
  constructor(index, timestamp, data, previous_hash) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previous_hash = previous_hash;
    this.hash = this.hash_block();
  }
  hash_block() {
    return sha256(this.index + this.timestamp + JSON.stringify(this.data) + this.previous_hash);
  }
  toJSON() {
    return {
      'index': this.index,
      'timestamp': this.timestamp,
      'data': this.data,
      'previous_hash': this.previous_hash,
      'hash': this.hash
    };
  }
}

var this_nodes_transactions = [];
var peer_nodes = {'peer1': 'http://localhost:3000', 'peer2': 'http://localhost:3001'};
var blockchain = [];

find_new_chain(() => {
  if (blockchain.length == 0) {
    blockchain.push(create_genesis_block());
  }
  app.listen(port);
});

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Valid routes are /give, /mine, /blocks. /give gives 1 coin to the other peer. /mine mines 25 coins. /blocks get the blockchain currently stored on this node. Note: this example allows negative balance.');
});

app.get('/give', (req, res) => {
  var new_txn = { 'from': miner_address, 'to': other_address, 'amount': 1, 'timestamp': Date.now()};
  this_nodes_transactions.push(new_txn);
  res.send(JSON.stringify(this_nodes_transactions));
});

app.get('/blocks', (req, res) => {
  var chain_to_send = [];
  for (var i = 0; i < blockchain.length; i++) {
    var block = blockchain[i];
    chain_to_send.push(block.toJSON());
  }
  res.json(chain_to_send);
});

app.get('/mine', (req, res) => {
  find_new_chain(() => {
    var last_block = blockchain[blockchain.length - 1];
    var last_proof = last_block.data['proof-of-work'];
    var proof = proof_of_work(last_proof);
    this_nodes_transactions.push({ 'from': 'network', 'to': miner_address, 'amount': 25, 'timestamp': Date.now() });
    var new_block_data = {
      'proof-of-work': proof,
      'transactions': this_nodes_transactions
    };
    var new_block_index = last_block.index + 1;
    var new_block_timestamp = Date.now();
    var last_block_hash = last_block.hash;
    this_nodes_transactions = [];
    var mined_block = new Block(
      new_block_index,
      new_block_timestamp,
      new_block_data,
      last_block_hash
    );
    blockchain.push(mined_block);
    res.json(blockchain.map((block) => {
      return block.toJSON();
    }));
  });
});

function create_genesis_block() {
  return new Block(0, Date.now(), {
    'proof-of-work': 9,
    'transactions': null
  }, '0');
}

function find_new_chain(callback) {
  request(peer_nodes[other_address] + '/blocks', function (error, response, body) {
    if (!error) {
      var other_chain = JSON.parse(body).map((element) => {
        return new Block(element.index, element.timestamp, element.data, element.previous_hash);
      });
      if (blockchain.length < other_chain.length) {
        blockchain = other_chain;
      }
    }
    if (callback) {
      callback();
    }
  });
}

function proof_of_work(last_proof) {
  var incrementor = last_proof + 1;
  while (incrementor % 9 != 0 || incrementor % last_proof != 0) {
    incrementor += 1;
  }
  return incrementor;
}

module.exports = app;
