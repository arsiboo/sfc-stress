const cluster = require('cluster');
const express = require('express');
const http = require('http');
const app = express();
const bodyParser = require('body-parser');
const router = require('./router')
const helper = require("./workloads/helper");
const now = require('nano-time');
let workersCount = process.env.WORKERS_COUNT;


let workers = [];

// credits: https://github.com/DanishSiddiq/Clustering
const setupWorkerProcesses = () => {
    console.log('Master cluster setting up ' + workersCount + ' workers');

    for (let i = 0; i < workersCount; i++) {
        workers.push(cluster.fork());

        workers[i].on('message', function (message) {
            // console.log(message);
        });
    }

    cluster.on('online', function (worker) {
        console.log('Worker ' + worker.process.pid + ' is listening');
    });

    // if any of the worker process dies then start a new one by simply forking another one
    cluster.on('exit', function (worker, code, signal) {
        console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        console.log('Starting a new worker');
        workers.push(cluster.fork());

        workers[workers.length - 1].on('message', function (message) {
            console.log(message);
        });
    });
};

// credits: https://github.com/DanishSiddiq/Clustering
const setUpExpress = () => {
    app.server = http.createServer(app);
    app.server.setTimeout(60000000);

    app.use(bodyParser.json({limit: '10000mb'}));
    app.use('/images', express.static('images'));
    app.use((req, res, next) => {
        const start = process.hrtime();
        console.log(`Received ${req.method} ${req.originalUrl} by process ID ${process.pid} from ${req.headers['referer']} at {${now()}} [RECEIVED]`)

        res.on('close', () => {
            const durationInMilliseconds = helper.getDurationInMilliseconds(start);
            console.log(`Closed received ${req.method} ${req.originalUrl} from ${req.headers['referer']} {${now()}} [CLOSED] ${durationInMilliseconds.toLocaleString()} ms`)
        });
        next();
    })

    router.setRouter(app);

    app.server.listen(30005, () => {
        console.log(`Started server on => http://localhost:${app.server.address().port} for Process Id ${process.pid}`);
    });
}

// credits: https://github.com/DanishSiddiq/Clustering
const setupServer = (isClusterRequired) => {
    // if it is a master process then call setting up worker process
    if (isClusterRequired && cluster.isMaster) {
        setupWorkerProcesses();
    } else {
        // to setup server configurations and share port address for incoming requests
        setUpExpress();
    }
};

setupServer(true);


