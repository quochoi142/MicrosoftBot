var firebase = require('firebase')
const config = require('./config')

const utils = {

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
        var refFirebase = firebase.database().ref('users/' + id);
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

    readRoute: async (id) => {
        firebase.initializeApp(config);
        var arr = [];

        return await firebase.database().ref('users/' + id).orderByChild('time').once('value')
            .then(function (snapshot) {
                snapshot.forEach(data => {
                    arr.push(data.val());


                })
                return arr.reverse();
            });

    },

    getIdUser: (context) => {
        const activity = Object.assign({}, context)._activity;
        return activity.from.id;
    },

    convertDuration: (secs) => {
        var h = Math.floor(secs / 3600)
        var m = Math.floor(secs % 3600 / 60);
        return h + 'h' + m + '\'';
    }

}

module.exports = utils
