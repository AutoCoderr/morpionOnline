const http = require('http'),
    url = require('url'),
    fs = require('fs'),
    players = {},
    playerSearching = {};

const {isFinish, getWinner, HEIGHT, WIDTH} = require("./libs");
const IA = require("./iaMorpion")

const server = http.createServer(function(req, res) { // --------------------------> LE SERVEUR HTTP <------------------------------------------------------
    let page = url.parse(req.url).pathname;
    const param = url.parse(req.url).query;
    if (page == "/") {
        page = "/index.html"
    } else if (page == "/socket.io/") {
        page = "/socket.io/socket.io.js"
    }
    page = __dirname + page
    const ext = page.split(".")[page.split(".").length-1]
    if (ext == "png" | ext == "jpg" | ext == "gif" | ext == "jpeg" | ext == "bmp" | ext == "tif" | ext == "tiff" | ext == "ico") {
       fs.readFile(page, function(error, content) {
         if(error){
           res.writeHead(404, {"Content-Type": "text/plain"});
           res.end("ERROR 404 : Page not found");
         } else {
           res.writeHead(200, {"Content-Type": "image/" + ext});
           res.end(content);
         }
      });
    } else {
        fs.readFile(page, 'utf-8', function(error, content) {
           if(error){
             res.writeHead(404, {"Content-Type": "text/plain"});
             res.end("ERROR 404 : Page not found");
           } else {
                 if (page == "./serv.js") {
                     res.writeHead(404, {"Content-Type": "text/plain"});
                     res.end("ERROR 404 : Page not found");
                 } else {
                     res.writeHead(200, {"Content-Type": "text/html"});
                     res.end(content);
                 }
           }
      });
    }
});

const io = require('socket.io')(server, {
    serveClient: false
});

io.sockets.on('connection', function (socket) {

    socket.on('login', function (pseudo) { // --------------------------------> LOGIN <--------------------------------------------
        if (typeof(socket.datas) != "undefined") {
            return;
        }
        let n = "";
        while(typeof(players[pseudo+n]) != "undefined") {
            if (n == "") {
                n = 2;
            } else {
                n += 1;
            }
        }
        pseudo = pseudo+n;
        players[pseudo] = {pseudo: pseudo, level: null, adversaire: null, playerType: null, isAi: false, nbWin: 0,
                           socket: socket, demmanded: "", playing: false, hisOwnTurn: null, voteToRestart: false};
        socket.datas = players[pseudo];
        console.log("new connected! : "+pseudo+" ("+remplace(socket.handshake.address,"::ffff:","")+")");
        socket.emit("newPseudo", pseudo)

        setTimeout(() => {
            let playersList = [];
            for (let unPseudo in players) {
                if (!players[unPseudo].playing) {
                    playersList.push(unPseudo);
                }
            }
            socket.emit("displayPlayers", playersList);
            socket.broadcast.emit("displayPlayers", playersList);
        },20);
    });

    socket.on('displayPlayers', function () {
        let playersList = [];
        for (let unPseudo in players) {
            if (!players[unPseudo].playing) {
                playersList.push(unPseudo);
            }
        }
        socket.emit("displayPlayers", playersList);
    });

    socket.on("clickMorpion", function(coor) {
        if (typeof(socket.datas) == "undefined" || !socket.datas.playing || !socket.datas.hisOwnTurn || !socket.datas.playing) {
            return;
        }

        clickMorpion(socket.datas,coor);
    });

    socket.on("acceptDemmand", function(pseudo) {
        if (typeof(socket.datas) == "undefined") {
            socket.emit("msg", {msg: "Le serveur à été relancé, veuillez actualiser", type: "error"});
            return;
        }

        if (typeof(players[pseudo]) == "undefined") {
            socket.emit("msg", {msg: "Ce joueur n'existe pas", type: "error"});
        } else if (players[pseudo].demmanded != socket.datas.pseudo) {
            socket.emit("msg", {msg: "Cet utilisateur ne vous a jamais envoyé de demande", type: "error"});
        } else {
            players[pseudo].demmanded = "";
            startGame(players[pseudo],socket.datas);
        }
    });

    socket.on('sendDemmand', function(pseudo) {
        if (typeof(socket.datas) == "undefined") {
            socket.emit("msg", {msg: "Le serveur à été relancé, veuillez actualiser", type: "error"});
            return;
        }

        if (typeof(players[pseudo]) == "undefined") {
            socket.emit("msg", {msg: "Ce joueur n'existe pas", type: "error"});
        } else if (players[pseudo].playing) {
            socket.emit("msg", {msg: "Ce joueur est dans une partie", type: "error"});
        } else {
            socket.datas.demmanded = pseudo;
            players[pseudo].socket.emit("demmand", socket.datas.pseudo);
        }
    });

    socket.on("playAgainstAi", function () {
        if (typeof(socket.datas) == "undefined" || socket.datas.playing || typeof(playerSearching[socket.data.pseudo]) != "undefined") {
            return;
        }
        const aiPlayer = {level: null, adversaire: null, playerType: null, isAi: true,
            demmanded: "", playing: false, hisOwnTurn: null}
        startGame(socket.datas,aiPlayer);
    });

    socket.on('searchPlayer', function() {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        playerSearching[socket.datas.pseudo] = socket.datas;
        for (let unPseudo in playerSearching) {
            if (unPseudo != socket.datas.pseudo) {
                delete playerSearching[unPseudo];
                delete playerSearching[socket.datas.pseudo];
                startGame(socket.datas,players[unPseudo]);
                break;
            }
        }
    });

    socket.on("stopSearch", function () {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (typeof(playerSearching[socket.datas.pseudo]) == "undefined") {
            return;
        }
        delete playerSearching[socket.datas.pseudo];
    });

    socket.on("restart", function () {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (socket.datas.voteToRestart) {
            return;
        }
        socket.datas.voteToRestart = true;
        let nb;
        if (socket.datas.adversaire.isAi || socket.datas.adversaire.voteToRestart) {
            nb = 2;
            setTimeout(() => {
                startGame(socket.datas, socket.datas.adversaire, false);
            }, 400);
        } else {
            nb = 1;
        }
        socket.emit("voteToRestart", nb);
        if (!socket.datas.adversaire.isAi)
            socket.datas.adversaire.socket.emit("voteToRestart", nb);
    });

    socket.on("quitParty", function () {
        if (typeof(socket.datas) == "undefined") {
            return;
        }
        if (socket.datas.adversaire == null) {
            return;
        }

        socket.datas.adversaire.socket.emit("quitParty");
        socket.emit("quitParty");

        socket.datas.adversaire.adversaire = null;
        socket.datas.adversaire = null;
    });

    socket.on('disconnect', function() { // ----------------------> DECONNEXION D'UN CLIENT <---------------------------------------
        if (typeof(socket.datas) != "undefined") {
            if (socket.datas.timeout != null) {
                clearTimeout(socket.datas.timeout);
            }
            if (socket.datas.adversaire != null) {
                socket.datas.adversaire.adversaire = null;

                socket.datas.adversaire.playing = false;
                if (!socket.datas.adversaire.isAi)
                    socket.datas.adversaire.socket.emit("quitParty");
                socket.datas.adversaire.playerType = null;
                socket.datas.adversaire.level = null;
            }

            const pseudo = socket.datas.pseudo;
            if (typeof(playerSearching[pseudo]) != "undefined") {
                delete playerSearching[pseudo];
            }
            console.log("disconnect "+pseudo+" ("+remplace(socket.handshake.address,"::ffff:","")+")");
            delete players[pseudo];
            let playersList = [];
            for (let pseudo in players) {
                if (!players[pseudo].playing) {
                    playersList.push(pseudo);
                }
            }
            socket.broadcast.emit("displayPlayers", playersList);
        }
    });
});

function clickMorpion(player, {l, c}) {
    const morpion = player.level;

    if (morpion[l][c] !== 0) {
        return;
    }

    morpion[l][c] = player.playerType;

    let winner = getWinner(morpion);

    if (!winner) {
        if (!isFinish(morpion)) {
            player.hisOwnTurn = false;
            player.adversaire.hisOwnTurn = true;

            if (!player.isAi)
                player.socket.emit("displayLevel", {tab: morpion, playerType: player.playerType, hisOwnTurn: player.hisOwnTurn, nbWin: player.nbWin, nbLost: player.adversaire.nbWin});

            if (!player.adversaire.isAi)
                player.adversaire.socket.emit("displayLevel", {tab: morpion, playerType: player.adversaire.playerType, hisOwnTurn: player.adversaire.hisOwnTurn, nbWin: player.adversaire.nbWin, nbLost: player.nbWin});

            const playerWhoNeedPlay = player.hisOwnTurn ? player : player.adversaire;
            if (playerWhoNeedPlay.isAi) {
                const ia = new IA(playerWhoNeedPlay.level,playerWhoNeedPlay.playerType);
                ia.startIa().then(({l,c}) => clickMorpion(playerWhoNeedPlay,{l,c}))
            }

        } else {
            gameOver(player);
        }
    } else {
        gameOver(player,winner);
    }
}

function gameOver(player, winner = null) {
    if (!player.playing) {
        return;
    }

    player.playing = false;
    player.adversaire.playing = false;

    let morpion = player.level;

    if (winner === player.playerType)
        player.nbWin += 1;
    else if (winner !== null)
        player.adversaire.nbWin += 1;


    if (!player.isAi)
        player.socket.emit("displayLevel", {tab: morpion, playerType: player.playerType, nbWin: player.nbWin, nbLost: player.adversaire.nbWin});
    if (!player.adversaire.isAi)
        player.adversaire.socket.emit("displayLevel", {tab: morpion, playerType: player.adversaire.playerType, nbWin: player.adversaire.nbWin, nbLost: player.nbWin});

    if (!player.isAi)
        player.socket.emit("endGame", {playerType: player.playerType, ...(winner != null ? {winner} : {}) });
    if (!player.adversaire.isAi)
        player.adversaire.socket.emit("endGame", {playerType: player.adversaire.playerType, ...(winner != null ? {winner} : {})});

    player.playerType = null;
    player.adversaire.playerType = null;

    player.level = null;
    player.adversaire.level = null;

    player.voteToRestart = false;
    player.adversaire.voteToRestart = false;
}

function getTheOnlySurvivor(party) {
    if (party.chef.playing) {
        return party.chef;
    }

    for (let i=0;i<party.participants.length;i++) {
       if (party.participants[i].playing) {
           return party.participants[i];
       }
    }

}


function startGame(J1,J2, newParty = true) {
    J1.playing = true;
    J2.playing = true;
    let tab = genNewMorpion();

    if (Math.round() < 0.5) {
        J1.hisOwnTurn = true;
        J2.hisOwnTurn = false;
    } else {
        J1.hisOwnTurn = false;
        J2.hisOwnTurn = true;
    }

    if (newParty) {
        J1.nbWin = 0;
        J2.nbWin = 0;
    }

    J1.level = tab;
    J2.level = tab;

    J1.adversaire = J2;
    J2.adversaire = J1;

    J1.playerType = 1;
    J2.playerType = 2;

    J1.socket.emit("displayLevel", {tab: tab, playerType: 1, hisOwnTurn: J1.hisOwnTurn, nbWin: J1.nbWin, nbLost: J2.nbWin});

    if (!J2.isAi)
        J2.socket.emit("displayLevel", {tab: tab, playerType: 2, hisOwnTurn: J2.hisOwnTurn, nbWin: J2.nbWin, nbLost: J1.nbWin});
    else if (J2.hisOwnTurn) {
        const ia = new IA(J2.level,J2.playerType);
        ia.startIa().then(({l,c}) => clickMorpion(J2,{l,c}))
    }

    let playersList = [];
    for (let unPseudo in players) {
        if (!players[unPseudo].playing) {
            playersList.push(unPseudo);
        }
    }

    for (let pseudo in players) {
        if (pseudo !== J1.pseudo && pseudo !== J2.pseudo) {
            players[pseudo].socket.emit("displayPlayers", playersList)
        }
    }
}

function genNewMorpion() {
    let tab = [];
    for (let l=0;l<HEIGHT;l++) {
        tab.push([]);
        for (let c=0;c<WIDTH;c++) {
            tab[l].push(0);
        }
    }
    return tab;
}

function remplace(str, A, B) {
    while(str.replace(A,B) != str) {
        str = str.replace(A,B);
    }
    return str;
}

server.listen(3002);
