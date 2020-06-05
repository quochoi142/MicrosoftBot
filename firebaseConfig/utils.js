var firebase = require('firebase')
const config = require('./config')
const polylineTool = require('../API/polyline')
var randomstring = require("randomstring");

const utils = {
    x: undefined,
    initialize_FireBase: () => {
        firebase.initializeApp(config);

    },
    saveRoute: (id, destination) => {
        //initialize firebase
        var db = firebase.database();

        //initialize route
        const obj = {};
        obj.destination = destination;
        obj.time = Date.now();

        //save db, each user contain the 5 latest route, 
        var refFirebase = firebase.database().ref('users/' + id + '/routes');
        refFirebase.once('value').then(function (snapshot) {
            const arr = snapshot.val();
            const leng = snapshot.numChildren();

            if (arr && leng > 4) {
                refFirebase.orderByChild('time').limitToFirst(1).once('value').then(function (data) {
                    var key = '';
                    data.forEach(function (childData) {
                        key = childData.key;
                    });

                    console.log(key);
                    firebase.database().ref('users/' + id).child(key).set(obj)
                });
            }
            else {
                const x = refFirebase.push();
                x.set(obj);
            }
        });
    },

    //Lưu cả điểm origin vs destination
    saveOriDes: (id, origin, destination) => {
        //Handle data in origin and destination
        if (origin[0] == '"') {
            origin = origin.replace('"', '');
            origin = origin.replace('"', '');

        }

        if (destination[0] == '"') {
            destination = destination.replace('"', '');
            destination = destination.replace('"', '');

        }

        //initialize firebase
        var db = firebase.database();

        //initialize route
        const obj = {};
        obj.origin = origin
        obj.destination = destination;
        obj.time = Date.now();

        //save db, each user contain the 5 latest route, 
        var refFirebase = firebase.database().ref('users/' + id + '/routes');
        refFirebase.once('value').then(function (snapshot) {
            const arr = snapshot.val();
            const leng = snapshot.numChildren();

            if (arr && leng > 4) {
                refFirebase.orderByChild('time').limitToFirst(1).once('value').then(function (data) {
                    var key = '';
                    data.forEach(function (childData) {
                        key = childData.key;
                    });

                    console.log(key);
                    firebase.database().ref('users/' + id).child(key).set(obj)
                });
            }
            else {
                const x = refFirebase.push();
                x.set(obj);
            }
        });
    },

    readStop: async (id) => {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        else {
            firebase.app();
        }

        var location;

        return await firebase.database().ref('users/' + id + '/location').once('value')
            .then(function (snapshot) {
                snapshot.forEach(data => {
                    location = data.val();


                })
                return location;
            });

    },
    getTokenbyId: async (id) => {
        return await firebase.database().ref('users/' + id + '/token').once('value')
            .then(function (snap) {

                return snap.val();
            });
    }
    ,

    readRoute: async (id) => {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        else {
            firebase.app();
        }

        var arr = [];

        return await firebase.database().ref('users/' + id + '/routes').orderByChild('time').once('value')
            .then(function (snapshot) {
                snapshot.forEach(data => {
                    arr.push(data.val());


                })
                console.log(arr);
                return arr.reverse();
            });

    },
    wait: () => {
        var flag = false;
        while (flag) {
            firebase.database().ref('flag').on('value', function () {
                flag = (snapshot.val()) ? true : false;
            });
        }
        return flag


    }

    ,

    getIdUser: (context) => {
        const activity = Object.assign({}, context)._activity;
        return activity.from.id;
    },

    convertDuration: (secs) => {
        var h = Math.floor(secs / 3600)
        var m = Math.floor(secs % 3600 / 60);

        const hh = h + 'h';
        const mm = m + '\'';
        var result = '';
        if (h != 0) {
            result += hh;
        }
        if (mm != 0) {
            result += mm;
        }
        return result;
    },


    sleep: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    convertPolylineX2: (polyline) => {
        const raw = polylineTool.decode(polyline);
        var result = '';
        // raw.polyline.forEach(e=>{
        //     result+=e;
        // })
        for (var i = 0; i < raw.polyline.length || i == raw.polyline.length - 1; i = i + 2) {
            result += raw.polyline[i] + ',';
        }
        result.replace(' ', '');
        return result.substring(0, result.length - 2);

        // const raw = polylineTool.decode(polyline);
        // var result='';
        // raw.polyline.forEach(e=>{
        //     result+=e+',';
        // })
        // result.replace(' ','');
        // return result.substring(0,result.length-2);
    },

    convertPolylineX1: (polyline) => {
        const raw = polylineTool.decode(polyline);
        var result = '';
        raw.polyline.forEach(e => {
            result += e + ',';
        })
        result.replace(' ', '');
        return result.substring(0, result.length - 2);

    },

    abc: () => {
        firebase.database().ref('flag').on('value', function (snap) {
            console.log('add in action', snap.val());

        });

        // return await firebase.database().ref('flag').on('value', await (snap => {
        //     console.log('add in action', snap.val());
        // }))
    }
    //         .then( snap=> {
    //             console.log('add in action', snap.val());
    //         });
    // }
    ,
    getFirebase: () => {
        return firebase;
    },


    setToken: (context) => {
        const activity = Object.assign({}, context)._activity;
        const id = activity.from.id;
        firebase.database().ref('users/' + id + '/token').set(randomstring.generate(10));
    },


    openMap: (id, token) => {
        var promise;

        promise = new Promise(function (resolve, reject) {
            var i = false;
            firebase.database().ref('users/' + id + '/location').on('value', async function (snap) {

                if (i) {
                    resolve({ location: snap.val(), token });

                }
                i = true;


            });

        });

        return promise;
    },
    isGeo: (geo) => {

        var tokens = geo.split('|');
        if (tokens.length == 3 && tokens[0].includes('.') && tokens[1].includes('.')) {
            return true;
        }

        return false;
    },
    getGeo: (geo) => {
        var tokens = geo.split('|');
        var myLocation = {
            geo: {
                lat: tokens[0],
                lng: tokens[1]
            },
            address: tokens[2]
        };

        return myLocation;

    },
    getPolylineGGMap: (polyline) => {
        const raw = polylineTool.decode(polyline);
        var result = [];
        raw.polyline.forEach(e => {
            const geo = {};
            geo.lat = e[0];
            geo.lng = e[1];
            result.push(geo);
        })

        return result;
    },

    savePolyline: (id, data) => {
        var promise;

        promise = new Promise(function (resolve, reject) {
            firebase.database().ref('users/' + id + '/dataRoute').set(data).then(err => {
                resolve();
            });
        });

        return promise;
    },


    saveNearestStop: (id, data) => {
        //initialize firebase
        var db = firebase.database();

        //initialize route
        const obj = {};
        obj.location = data;
        obj.time = Date.now();

        //save db, each user contain the 5 latest route, 
        var refFirebase = firebase.database().ref('users/' + id + '/stops');
        refFirebase.once('value').then(function (snapshot) {
            const arr = snapshot.val();
            const leng = snapshot.numChildren();

            if (arr && leng > 4) {
                refFirebase.orderByChild('time').limitToFirst(1).once('value').then(function (data) {
                    var key = '';
                    data.forEach(function (childData) {
                        key = childData.key;
                    });

                    console.log(key);
                    firebase.database().ref('users/' + id).child(key).set(obj)
                });
            }
            else {
                const x = refFirebase.push();
                x.set(obj);
            }
        });


    },

    saveDepartures: (id, data) => {
        //initialize firebase
        var db = firebase.database();

        //initialize route
        const obj = {};
        obj.data = data;
        obj.time = Date.now();

        //save db, each user contain the 5 latest route, 
        var refFirebase = firebase.database().ref('users/' + id + '/departures');
        refFirebase.once('value').then(function (snapshot) {
            const arr = snapshot.val();
            const leng = snapshot.numChildren();

            if (arr && leng > 4) {
                refFirebase.orderByChild('time').limitToFirst(1).once('value').then(function (data) {
                    var key = '';
                    data.forEach(function (childData) {
                        key = childData.key;
                    });

                    console.log(key);
                    firebase.database().ref('users/' + id).child(key).set(obj)
                });
            }
            else {
                const x = refFirebase.push();
                x.set(obj);
            }
        });
    },

    sendMsgFb: (msg, id) => {
        const request = require('request')
        const PAGE_ACCESS_TOKEN = "EAADGyAwheb8BANMhZBGY88gm4KTmelQ8a0VZCOarWPsBelQS5uZAgYp4b3XyZClJiTWgKZCg0PNTAn4a0ReyxQwJlvbVqj9bSiBCLw9Elvn7sU3ZCQtBLE1caYaRsdNphRiJLw8HkWqdQxZBZBs1Q3eNNRwO5CrcocdFS0aLkiZCN3FMa5C3HktPz"
        var messageData = {
            "recipient": {
                "id": id
            },
            "message": {
                "text": msg
            },
            "messaging_type": "MESSAGE_TAG",
            "tag": "ACCOUNT_UPDATE"

        };

        // Start the request
        request({
            url: 'https://graph.facebook.com/v7.0/me/messages?access_token=' + PAGE_ACCESS_TOKEN,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            form: messageData
        },
            function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    // Print out the response body
                    console.log(body);

                } else {
                    // TODO: Handle errors
                    console.log(body);
                }
            });
    },

    notify: async (geo, place, bus, id) => {
        var encodeUrl = require('encodeurl');
        const fetch = require("node-fetch");
        var refFirebase = firebase.database().ref('users/' + id + '/noti');
        refFirebase.once('value').then(async function (snapshot) {
            if (snapshot.val() == true) {
                const date = new Date()
                const day = date.getDay();
                if (day > 0 && day < 6) {
                    // var requestOptions = {
                    //     method: 'GET',
                    // };
                    // fetch(encodeUrl("https://localhost:3978/api/notify?geo=" + geo.lat + ',' + geo.lng + "&place=" + place + "&bus=" + bus), requestOptions)


                    //const fetch = require("node-fetch");
                    //var encodeUrl = require('encodeurl');
                    var stringSimilarity = require('string-similarity');

                    const url = 'https://transit.hereapi.com/v8/departures?maxPerBoard=10&lang=vi&in=' + geo.lat + "," + geo.lng + ';r=1000&name=' + place;
                    var myHeaders = new fetch.Headers();
                    myHeaders.append("Authorization", 'Bearer ' + process.env.token);

                    var requestOptions = {
                        method: 'GET',
                        headers: myHeaders,
                        redirect: 'follow'
                    };
                    const response = await fetch(encodeUrl(url), requestOptions)
                    const data = await response.json();

                    if (data.boards.length == 0) {
                        prompt = 'Không tìm thấy trạm ' + place;

                    } else {
                        const boards = data.boards;
                        var isExistsBus = false;
                        for (var i = 0; i < boards.length; i++) {
                            var msg = '';
                            if (stringSimilarity.compareTwoStrings(boards[i].place.name.toLowerCase(), place.toLowerCase()) > 0.7) {
                                const departures = boards[i].departures;


                                for (var j = 0; j < departures.length; j++) {
                                    if (bus.match('(\\d+)')[0] == parseInt(departures[j].transport.name)) {
                                        isExistsBus = true
                                        var time = departures[j].time;
                                        const moment = require('moment')
                                        var now = moment().format("YYYY-MM-DDTHH:mm:ssZ");

                                        time = moment.utc(moment(time, "YYYY-MM-DDTHH:mm:ssZ").diff(now)).format('HH:mm')
                                        const tokens = time.split(":");
                                        const h = tokens[0]
                                        const m = tokens[1]
                                        time = "";
                                        if (h != 0) {
                                            time += parseInt(h) + "h";
                                        }
                                        if (m != 0) {
                                            time += parseInt(m) + "'";
                                        }
                                        time = (time == "") ? "1'" : time;

                                        msg = "Xe bus số " + departures[j].transport.name + " xuất phát từ " + departures[j].transport.headsign + " khoảng " + time + " sẽ đi qua trạm " + boards[i].place.name;
                                        break;
                                    }
                                }


                            }
                            if (msg !== "") {
                                //await stepContext.context.sendActivity(msg);
                                utils.sendMsgFb(msg, id)
                            }

                        }
                        if (!isExistsBus) {
                            //await turnContext.sendActivity("Có vẻ như xe bus này không đi qua trạm");
                            //await stepContext.context.sendActivity("Có vẻ như xe bus này không đi qua trạm")
                            utils.sendMsgFb(msg, id)
                        }
                    }




                    var time = (day == 5) ? 258600000 : 85800000;
                    setTimeout(utils.notify, time, geo, place, bus, id)
                    firebase.database().ref('users/' + id).child("/noti/TimeOut").set(day + "-------" + time)
                }

            }
        })


    },

    isTurnOnNotify: async (id) => {
        return await firebase.database().ref('users/' + id + "/noti").once('value')
            .then(function (snapshot) {
                //console.log(snapshot.val())
                return snapshot.val();
            });

        // const promise= new Promise(function (resolve,reject){
        //     firebase.database().ref('users/' + id+"/noti" ).once('value').then(function (snap){
        //         resolve(snap.val());
        //     })
        // })
        // return promise
    }


}

module.exports = utils
