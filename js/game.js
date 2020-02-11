'use strict';
var key = {};
var scene, world, camera, renderer, controls, clock;
var stage, marble;
var delta = 0;
var cube
var rigidBodies = [];

var orientation_debug = document.getElementById("device-orientation");
start();

function start() {
    initCannonjs();
    initThreejs();
    stage = createBox({position: new CANNON.Vec3(0,-2,0),
        extents: new CANNON.Vec3(20,1,20),
        color: new THREE.Color(0xe1e1e1) });
        marble = createBall({mass: 1});

    animate();
}

function initThreejs() {
    clock = new THREE.Clock();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.2, 5000);
    camera.position.set(0,30,70);
    camera.lookAt(new THREE.Vector3(0,0,0))

    // hemilight
    let hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.1);
    hemiLight.color.setHSL(0.6, 0.6, 0.6);
    hemiLight.groundColor.setHSL(0.1, 1, 0.4);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    // dirlight
    let dirLight = new THREE.DirectionalLight( 0xffffff , 1);
    dirLight.color.setHSL( 0.1, 1, 0.95 );
    dirLight.position.set( -1, 1.75, 1 );
    dirLight.position.multiplyScalar( 100 );
    scene.add( dirLight );
    
    dirLight.castShadow = true;
    dirLight.shadow.mapSize = new THREE.Vector2(2048, 2048);

    let d = 50;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.far = 13500;


    
    renderer = new THREE.WebGLRenderer({antialias: false});
    renderer.setClearColor(0xbfd1e5);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    renderer.gammaInput = true;
    renderer.gammaOutput = true;
    renderer.shadowMap.enabled = true;
    
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableKeys = false;
}

function initCannonjs() {
    // add easy euler rotation access to rigidbody prototype
    CANNON.Body.prototype.rotation = function(x,y,z) {
        if (x==undefined) {
            return this.euler;
        } else {
            this.quaternion.setFromEuler(x,y,z);
            this.euler = {x:x,y:y,z:z};
        }
    }
    Object.defineProperty(CANNON.Body.prototype, "rotationx", {
        set: function(val) {
            this.euler.x =  val;
            this.quaternion.setFromEuler(this.euler.x,this.euler.y,this.euler.z);
        },
        get: function() {
            return this.euler.x;
        }
    })
    Object.defineProperty(CANNON.Body.prototype, "rotationy", {
        set: function(val) {
            this.euler.y = val
            this.quaternion.setFromEuler(this.euler.x,this.euler.y,this.euler.z);
        },
        get: function() {
            return this.euler.y;
        }
    })
    Object.defineProperty(CANNON.Body.prototype, "rotationz", {
        set: function(val) {
            this.euler.z = val
            this.quaternion.setFromEuler(this.euler.x,this.euler.y,this.euler.z);
        },
        get: function() {
            return this.euler.z;
        }
    })


    world = new CANNON.World();
    world.gravity.set(0,-9.82,0);
    world.broadphase = new CANNON.NaiveBroadphase();


    var physicsMaterial = new CANNON.Material("groundMaterial");
    var physicsContactMaterial = new CANNON.ContactMaterial(
            physicsMaterial,
            physicsMaterial,
            {friction: 0.4, restitution: 0.0}
    );
    world.addContactMaterial(physicsContactMaterial)

    var otherMaterial = new CANNON.Material("slipperyMaterial");
    var otherContactMaterial = new CANNON.ContactMaterial(
        physicsMaterial,
        otherMaterial,
        {friction: 0.0, restitution: 0.9}
    ); 
    world.addContactMaterial(otherContactMaterial);
    // var mass = 5, radius = 1;
    // var sphereShape = new CANNON.Sphere(radius); // Step 1
    // window.sphereBody = new CANNON.Body({mass: mass, shape: sphereShape}); // Step 2
    // sphereBody.position.set(0,0,0);
    // world.add(sphereBody); // Step 3


    // var groundShape = new CANNON.Plane();
    // var groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    // world.add(groundBody);


    
}

function animate(time) {
    delta = clock.getDelta() || 1/60;
    // stage.rotationx += 0.01;
    // stage.rotationy += 0.01;
    if (key.ArrowLeft) stage.rotationz += 0.02;
    if (key.ArrowRight) stage.rotationz -= 0.02;
    if (key.ArrowUp) stage.rotationx -= 0.02;
    if (key.ArrowDown) stage.rotationx += 0.02;
    
    world.step(delta);
    syncPhys();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

function createBox(options={}) {
    defaultOptions(options);
    // cannonjs
    var shape = new CANNON.Box(new CANNON.Vec3(options.extents.x/2,options.extents.y/2,options.extents.z/2));
    var body = new CANNON.Body({mass: options.mass, shape:shape, position: options.position});

    var geometry = new THREE.BoxBufferGeometry(options.extents.x,options.extents.y,options.extents.z)
    return createShape(shape,geometry,options);
}

function createBall(options={}) {
    defaultOptions(options);
    var shape = new CANNON.Sphere(options.radius);
    var geometry = new THREE.SphereBufferGeometry(options.radius)
    return createShape(shape,geometry,options);   
}

function defaultOptions(options) {
    options.extents = options.extents || new CANNON.Vec3(1,1,1);
    options.radius = options.radius || 1;
    options.position = options.position || new CANNON.Vec3(0,0,0);
    options.meshMaterial = options.meshMaterial || new THREE.MeshBasicMaterial({color: 0xffffff});
    options.mass = options.mass || 0;
    options.quaternion = options.quaternion || new CANNON.Quaternion(0,0,0,1);
    options.color = options.color || new THREE.Color(Math.random(),Math.random(),Math.random())
}
function createShape(shape,geometry,options) {
    var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: options.color}));
    mesh.castShadow = mesh.receiveShadow = true; // enable shadows
    scene.add(mesh); // add mesh to graphics world

    var body = new CANNON.Body({mass: options.mass, shape:shape, position: options.position});
    body.mesh = mesh; // reference mesh from physicsbody
    body.euler = {x:0, y:0, z:0};
    mesh.userData.body = body; // reference physicsbody from mesh
    world.add(body); // add body to physics world
    
    rigidBodies.push(body); // add physicsbody to processing array
    return body;   
}


function syncPhys () {
    rigidBodies.forEach((body)=>{
        let mesh = body.mesh;
        mesh.position.set(body.position.x, body.position.y, body.position.z)
        mesh.quaternion.set(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w)
    })
}



window.addEventListener("deviceorientation", function(event) {
    var rotateDegrees = event.alpha*(Math.PI/180);
    var leftToRight = event.gamma*(Math.PI/180);
    var frontToBack = event.beta*(Math.PI/180);
    orientation_debug.innerHTML = `${rotateDegrees}, ${leftToRight}, ${frontToBack}`;
    stage.rotationx = frontToBack;
    stage.rotationz = -leftToRight;
    
}, true)

// resize viewport automatically
window.addEventListener("resize", function() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    renderer.setSize(width,height);
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
})
// input listening
document.addEventListener('keydown', function(event) {
    key[event.code] = true;
});
document.addEventListener('keyup', function(event) {
    key[event.code] = false;
});







