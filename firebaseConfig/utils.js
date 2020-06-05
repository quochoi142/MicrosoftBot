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
    readBus: async (id) => {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        else {
            firebase.app();
        }

        var arr = [];
        var arr2 = [];
        return await firebase.database().ref('users/' + id + '/departures').orderByChild('time').once('value')
            .then(function (snapshot) {
                snapshot.forEach(data => {
                    arr.push(data.val());


                })

                // remove the duplicate element
                for (var i = 0; i < arr.length; i++) {
                    var Isduplicate = 0;
                    for (var j = 0; j < arr2.length; j++) {

                        if ((arr[i].data.bus == arr2[j])) {
                            Isduplicate = 1;
                            break;
                        }

                    }

                    if (Isduplicate)
                        continue;

                    arr2.push(arr[i].data.bus);
                }

                return arr2.reverse();

            });
    },
    readDeparture: async (id) => {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        else {
            firebase.app();
        }

        var arr = [];
        var arr2 = [];
        return await firebase.database().ref('users/' + id + '/departures').orderByChild('time').once('value')
            .then(function (snapshot) {
                snapshot.forEach(data => {
                    arr.push(data.val());

                })

                // remove the duplicate element
                for (var i = 0; i < arr.length; i++) {
                    var Isduplicate = 0;
                    for (var j = 0; j < arr2.length; j++) {

                        if ((arr[i].data.departure == arr2[j])) {
                            Isduplicate = 1;
                            break;
                        }

                    }

                    if (Isduplicate)
                        continue;

                    arr2.push(arr[i].data.departure);
                }

                return arr2.reverse();

            });
    },
    getTokenbyId: async (id) => {
        return await firebase.database().ref('users/' + id + '/token').once('value')
            .then(function (snap) {

                return snap.val();
            });
    }
    ,

    readDestination: async (id) => {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        else {
            firebase.app();
        }

        var arr = [];
        var arr2 = [];

        return await firebase.database().ref('users/' + id + '/routes').orderByChild('time').once('value')
            .then(function (snapshot) {
                snapshot.forEach(data => {
                    arr.push(data.val());

                })
                  // remove the duplicate element
                  for (var i = 0; i < arr.length; i++) {
                    var Isduplicate = 0;
                    for (var j = 0; j < arr2.length; j++) {

                        if ((arr[i].destination == arr2[j])) {
                            Isduplicate = 1;
                            break;
                        }

                    }

                    if (Isduplicate)
                        continue;

                    arr2.push(arr[i].destination);
                }

                return arr2.reverse();
            });

    },
    readOrigin: async (id) => {
        if (!firebase.apps.length) {
            firebase.initializeApp(config);
        }
        else {
            firebase.app();
        }

        var arr = [];
        var arr2 = [];

        return await firebase.database().ref('users/' + id + '/routes').orderByChild('time').once('value')
            .then(function (snapshot) {
                snapshot.forEach(data => {
                    arr.push(data.val());

                })
                  // remove the duplicate element
                  for (var i = 0; i < arr.length; i++) {
                    var Isduplicate = 0;
                    for (var j = 0; j < arr2.length; j++) {

                        if ((arr[i].origin == arr2[j])) {
                            Isduplicate = 1;
                            break;
                        }

                    }

                    if (Isduplicate)
                        continue;

                    arr2.push(arr[i].origin);
                }

                return arr2.reverse();
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
        //Handle data in origin and destination
        if (data.bus[0] == '"') {
            data.bus = data.bus.replace('"', '');
            data.bus = data.bus.replace('"', '');

        }

        if (data.departure[0] == '"') {
            data.departure = data.departure.replace('"', '');
            data.departure = data.departure.replace('"', '');

        }


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
    }


}

module.exports = utils
