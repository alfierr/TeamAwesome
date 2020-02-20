'use strict';
var key = {}; // object for holding which keys are being pressed
var scene, world, camera, renderer, controls, clock, skybox, hemiLight, dirLight, textureLoader;
var cursorRaycaster = new THREE.Raycaster(); // raycaster to detect if cursor is over an object in 3d scene
var mouse = new THREE.Vector2(); // 2d vector for mouse position
var mouseDown = false;
var touchX=0,touchY=0; // touch coordinates on joystick controls
var titleScreen = document.getElementById("title-screen");
var stage, marble, david, davidText, rain;
var furthest // keeps track of furthest platform currently in existence;
var delta = 0; // amount of time that has passed each frame
var paused = true;
var cameraFocus = {}; cameraFocus.position = new THREE.Vector3(0,0,0); // holds focus element for camera to look towards
var cameraFocusTrailer = new THREE.Vector3(0,0,0); // point that smoothly follows camera focus element to allow smooth camera turning
var rigidBodies = []; // array for holding of all physics objects that need to be processed
var handlers = []; // array of functions that get called every frame
var platforms = [];
var cg_default = 1, cg_stage = 2, cg_joint = 4; // collision groups
var touchControls = document.getElementById("touch-controls"); // touchscreen controls
var touchJoystick = document.getElementById("touch-joystick"); // joystick visual element for touchscreen controls
var heightScore = document.getElementById("current-height"); // onscreen height
var platformScore = document.getElementById("current-platform"); // onscreen platform score
var weatherInterface = document.getElementById("weather-interface")
start();

function start() { // do stuff

    initCannonjs();
    initThreejs();
    furthest = stage = createBox({position: new CANNON.Vec3(0,-2,0), // setup first stage
        extents: new CANNON.Vec3(20,3,20),
        color: new THREE.Color(0xe1e1e1),
        type: CANNON.Body.KINEMATIC,
        group: cg_stage});
    stage.target = new CANNON.Vec3(0,0,0); // target rotation
    stage.originalPos = new CANNON.Vec3().copy(stage.position);
    stage.platformNumber = 0;
    cameraFocus = stage.mesh;
    platforms.push(stage);
    marble = createBall({radius: 2,mass: 0.1, mask: cg_default | cg_stage});
    marble.addEventListener("collide", function(e) { // listen for collisions and switch focus to new stage 
        stage.angularVelocity = new CANNON.Vec3();
        cameraFocus = stage = e.body;
        if (stage.platformNumber > platformScore.innerHTML) platformScore.innerHTML = stage.platformNumber;
        camera.minDist = 1;
    });
    setSkybox("clear-sky");
    animate();
}

function initThreejs() { // setup threejs scene
    clock = new THREE.Clock();
    textureLoader = new THREE.TextureLoader();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.2, 5000);
    camera.position.set(0,20,35);
    camera.maxDist = 40;
    camera.minDist = 20;
    camera.lookAt(cameraFocus.position)
    addHandler(camera, function() { // the camera follows the current camerafocus object
        camera.lookAt(cameraFocusTrailer); // camera is always looking at the camerafocustrailer (which follow the focused object)
        camera.position.lerp(new THREE.Vector3(
            Math.min(Math.max(cameraFocus.position.x-5,cameraFocus.position.x),cameraFocus.position.y+5), // stay aligned with focus element on x axis
            Math.min(Math.max(cameraFocus.position.y+camera.minDist,camera.position.y),cameraFocus.position.y+camera.maxDist), // stay within 50 units of of camerafocus but not more than 20 (on y and z axes)
            Math.min(Math.max(cameraFocus.position.z+camera.minDist,camera.position.z),cameraFocus.position.z+camera.maxDist) 
            ),0.10) // 10% lerp
    });

    // hemilight
    hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.1);
    hemiLight.color.setHSL(0.6, 0.6, 0.6);
    hemiLight.groundColor.setHSL(0.1, 1, 0.4);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    // dirlight
    dirLight = new THREE.DirectionalLight( 0xffffff , 1);
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

    // setup skybox
    skybox = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())
    scene.add(skybox);
    skybox.scale.set(500,500,500); // big skybox
    addHandler(skybox,function() { // the skybox moves to stay always centered around the camera so it looks like it never gets closer
        skybox.position.x = camera.position.x;
        skybox.position.y = camera.position.y;
        skybox.position.z = camera.position.z;
    })

    // rain geometry 
    let rainCount = 5000;
    let rainGeo = new THREE.Geometry();
    for(let i=0;i<rainCount;i++) {
        let rainDrop = new THREE.Vector3(
            Math.random() * 400 -200,
            Math.random() * 500 - 250,
            Math.random() * 400 - 200
        );
        rainDrop.velocity = 0;
        rainGeo.vertices.push(rainDrop);
    }

    let rainMaterial = new THREE.PointsMaterial({
        color: 0xaaaaaa,
        size: 0.3,
        transparent: true
    });
    rain = new THREE.Points(rainGeo,rainMaterial);
    rain.mode = 0;
    rain.visible = false;
    scene.add(rain);
    addHandler(rain, function() {
        rainGeo.vertices.forEach(p => {
            if (rain.mode == 0) p.velocity -= 0.01 + Math.random() * 0.01;
            if (rain.mode == 1) p.velocity -= 0.001 + Math.random() * 0.001;
            p.y += p.velocity;
            if (p.y < -200) {
                p.y = 200;
                p.velocity = 0;
            }
            });
        rainGeo.verticesNeedUpdate = true;
        rain.rotation.y +=0.002;
    });


    // david mode
    var davidGeom = new THREE.PlaneBufferGeometry(3,3)
    david = new THREE.Mesh(davidGeom,new THREE.MeshBasicMaterial({map: textureLoader.load(`img/textures/david.png`), side: THREE.DoubleSide}));
    scene.add(david);
    david.visible = false;
    addHandler(david, function(){ // david follows (slightly above) the marble and is always facing the camera
        david.position.lerp(new THREE.Vector3(0,5,0).add(marble.position),0.1);
        david.lookAt(camera.position)
    })
    var davidGeom2 = new THREE.PlaneBufferGeometry(3,2)
    davidText = new THREE.Mesh(davidGeom2,new THREE.MeshBasicMaterial({transparent: true, opacity:0, map: textureLoader.load(`img/textures/david-text.png`)}));
    davidText.position.set(0,2.6,0);
    david.add(davidText);
    addHandler(davidText, function() { // if you hover over the david it makes text fade in that says "david"
        var intersect = cursorRaycaster.intersectObject(david, false);
        if(intersect.length > 0) {
            davidText.material.opacity = Math.min(davidText.material.opacity+0.1,1);
        } else {
            davidText.material.opacity = Math.max(davidText.material.opacity-0.1,0);
        }
    });
    // renderer
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setClearColor(0xbfd1e5);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    renderer.domElement.addEventListener("mousedown", function(){
        mouseDown = true;
    });
    renderer.domElement.addEventListener("mouseup", function(){
        mouseDown = false;
    });

    renderer.gammaInput = true;
    renderer.gammaOutput = true;
    renderer.shadowMap.enabled = true;
    
    // controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableKeys = false;
}

function initCannonjs() { // setup physics world
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
    world.gravity.set(0,-100,0);
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

function setSkybox(name) { // change world skybox by resource folder name
    if (name == "cloudy-sky") {dirLight.intensity = 0.8; hemiLight.intensity = 0.05;}
    if (name == "rainy-sky") {dirLight.intensity = 0.5; hemiLight.intensity = 0.02;}
    if (name == "snowy-sky") {dirLight.intensity = 0.8; hemiLight.intensity = 0.04; dirLight.color.set(0xdedeff)} else {dirLight.color.set(0xfff4e5)}
    if (name == "clear-sky") {dirLight.intensity = 1; hemiLight.intensity = 0.1;}
    skybox.material = [
    new THREE.MeshBasicMaterial( {map: textureLoader.load(`img/textures/skybox/${name}/right.png`), side: THREE.DoubleSide}),
    new THREE.MeshBasicMaterial( {map: textureLoader.load(`img/textures/skybox/${name}/left.png`), side: THREE.DoubleSide}),
    new THREE.MeshBasicMaterial( {map: textureLoader.load(`img/textures/skybox/${name}/up.png`), side: THREE.DoubleSide}),
    new THREE.MeshBasicMaterial( {map: textureLoader.load(`img/textures/skybox/${name}/down.png`), side: THREE.DoubleSide}),
    new THREE.MeshBasicMaterial( {map: textureLoader.load(`img/textures/skybox/${name}/front.png`), side: THREE.DoubleSide}),
    new THREE.MeshBasicMaterial( {map: textureLoader.load(`img/textures/skybox/${name}/back.png`), side: THREE.DoubleSide})
    ]
}

function animate(time) { // animation loop
    if(!paused) {
    delta = clock.getDelta()/2 || 1/60; // get delta (amount of time that has passed since the last frame)

    // rotate stage with arrow keys
    if (key.ArrowLeft) stage.rotationz += 0.08;
    if (key.ArrowRight) stage.rotationz -= 0.08;
    if (key.ArrowUp) stage.rotationx -= 0.08;
    if (key.ArrowDown) stage.rotationx += 0.08;

    if (key.ArrowLeft || key.ArrowRight || key.ArrowDown || key.ArrowUp) touchControls.style.display = "none"; // turn off touch controls if arrow keys are pressed
    stage.rotationz = Math.min(Math.max(stage.rotationz - touchX*0.08,-Math.PI/2),Math.PI/2); // limit stage rotation on both axes to pi/2 radians in either direction
    stage.rotationx = Math.min(Math.max(stage.rotationx + touchY*0.08,-Math.PI/2),Math.PI/2);

    heightScore.innerHTML = Math.floor(marble.position.y);

    if(key.Space) { // jump stage if space is pressed
        stageJump();
    }

    rain.position.lerp(camera.position,0.01);

    camera.minDist = lerp(camera.minDist, 20, 0.02);


    if (furthest.position.y-marble.position.y < 200) { // generate new platforms if furthest platform is not more than 200 units above
        let s1 = Math.sign(Math.random()-0.5)
        let next = createBox({
            position: new CANNON.Vec3(
                furthest.position.x+(s1*Math.random()*10)+(5*s1),
                furthest.position.y+5+Math.random()*10,
                furthest.position.z+(-Math.random()*25)+(-5)),
            extents: new CANNON.Vec3(Math.random()*15+20,3,Math.random()*15+20),
            color: new THREE.Color(0xe1e1e1),
            type: CANNON.Body.KINEMATIC,
            group: cg_stage});
        next.platformNumber = furthest.platformNumber+1;
        next.originalPos = new CANNON.Vec3().copy(next.position);
        next.target = new CANNON.Vec3(0,0,0);
        platforms.push(next);
        furthest = next;
    }

    cameraFocusTrailer.lerp(cameraFocus.position,0.10); // make camera-trailing point follow the camera

    if (marble.position.distanceTo(stage.position) > 30) { // if the marble is more than 30 units away from the stage, change focus to the marble
        cameraFocus = marble;
    }

    if (stage.position.y - marble.position.y > 30) { // if marble falls off reset back around start position
        marble.position = new CANNON.Vec3(stage.position.x,stage.position.y+30,stage.position.z);
        marble.velocity = new CANNON.Vec3(0,0,0)
        stage.rotation(0,0,0);  
        cameraFocus = marble;
        camera.minDist = 1;
    }

    for (let i=0; i<handlers.length; ++i) { // execute all handler functions in array once per frame
        handlers[i]();
    }


    

    world.step(delta); // step through physics
    syncPhys(); // sync 3d scene with physics
    renderer.render(scene, camera); // render scene to screen
    } else (clock.getDelta())
    requestAnimationFrame(animate); // next loop
}

function createBox(options={}) { // sets up a box
    defaultOptions(options);
    // cannonjs
    var shape = new CANNON.Box(new CANNON.Vec3(options.extents.x/2,options.extents.y/2,options.extents.z/2));
    var body = new CANNON.Body({mass: options.mass, shape:shape, position: options.position});

    var geometry = new THREE.BoxBufferGeometry(options.extents.x,options.extents.y,options.extents.z)
    return createShape(shape,geometry,options);
}

function createBall(options={}) { // sets up a ball
    defaultOptions(options);
    var shape = new CANNON.Sphere(options.radius);
    var geometry = new THREE.SphereBufferGeometry(options.radius)
    return createShape(shape,geometry,options);   
}

function defaultOptions(options) { // helper for by shape creating functions functions
    options.extents = options.extents || new CANNON.Vec3(1,1,1);
    options.radius = options.radius || 1;
    options.position = options.position || new CANNON.Vec3(0,0,0);
    options.meshMaterial = options.meshMaterial || new THREE.MeshBasicMaterial({color: 0xffffff});
    options.mass = options.mass || 0;
    options.quaternion = options.quaternion || new CANNON.Quaternion(0,0,0,1);
    options.color = options.color || new THREE.Color(Math.random(),Math.random(),Math.random())
    if (options.invisible == undefined) options.invisible = false;
    if (options.group == undefined) options.group = 1;
    if (options.mask == undefined) options.mask = 1;
}
function createShape(shape,geometry,options) { // called by shape creating functions
    var body = new CANNON.Body({mass: options.mass, shape:shape, position: options.position, type: options.type});
    body.collisionFilterGroup = options.group;
    body.collisionFilterMask = options.mask;
    body.euler = {x:0, y:0, z:0};
    
    world.add(body); // add body to physics world
    
    if (!options.invisible) { // if body is meant to be visible
        var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: options.color, transparent: (options.opacity != undefined)})); // create mesh
        mesh.castShadow = mesh.receiveShadow = true; // enable shadows
        scene.add(mesh); // add mesh to graphics world
        mesh.userData.body = body; // reference physicsbody from mesh
        mesh.name = options.name;

        body.mesh = mesh; // reference mesh from physicsbody
        rigidBodies.push(body); // add physicsbody to processing array
    }

    return body;   
}
function removeObject(obj) { // remove objects in physics world and 3d scene
    if (obj instanceof CANNON.Body) {
        world.remove(obj)        
        if (obj.mesh) scene.remove(obj.mesh);

        var idx = rigidBodies.indexOf(obj);
        if (idx!=-1) rigidBodies.splice(idx,1);
    }
    else {
        scene.remove(obj)
        if (obj.userData.body) world.remove(obj.userData.body)
        var idx = rigidBodies.indexOf(obj.userData.body);
        if (idx!=-1) rigidBodies.splice(idx,1);
    }
}

function syncPhys () { // sync objects in visible 3d scene with their physics world counterparts 
    rigidBodies.forEach((body)=>{
        if (body.mesh != undefined) {
            let mesh = body.mesh;
            mesh.position.set(body.position.x, body.position.y, body.position.z)
            mesh.quaternion.set(body.quaternion.x,body.quaternion.y,body.quaternion.z,body.quaternion.w)   
        }
    })
}

function lerp(from,to,weight=0.10) { // lerp for lerping
    if (Math.abs(to-from) < 0.001) return to;
    return from+((to-from)*weight)
}

function stageJump() { // temporarily add forward velocity to stage to launch marble
    var matrix = new THREE.Matrix4(); // get rotation matrix
    matrix.extractRotation( stage.mesh.matrix );
    
    var direction = new THREE.Vector3( 0, 1, 0 ); // apply rotation to vector
    direction = direction.applyMatrix4(matrix);
    let m = 50; // magnitude of velocity
    let cStage = stage; // use reference to current stage in case it changes
    cStage.velocity = new CANNON.Vec3(direction.x*m,direction.y*m,direction.z*m);
    setTimeout(function(){ // timeout to reset stage back to its normal position
        cStage.position = new CANNON.Vec3().copy(cStage.originalPos);
        cStage.velocity = new CANNON.Vec3(0,0,0);
    },50)
}

window.addEventListener("mousemove", function(event) { // keep track of cursor and raycast to 3d scene to detect if cursor is over an object
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

    cursorRaycaster.setFromCamera(mouse, camera);
});

window.addEventListener("deviceorientation", function(event) { // device orientation game controls
    if(event.alpha == null) return; // every time you enter the tab even on desktop an orientation event fires with all null orientations so this is to avoid responding to that
    var rotateDegrees = event.alpha*(Math.PI/180);
    var leftToRight = event.gamma*(Math.PI/180);
    var frontToBack = event.beta*(Math.PI/180);
    if(frontToBack) {touchControls.style.display = "none";}
    stage.rotationx = frontToBack;
    stage.rotationz = -leftToRight;
    
}, true);

window.addEventListener('devicemotion', function(event) {
    if (event.acceleration.z > 8 && stage.velocity.almostZero()) {
        stageJump();
    }
});

var playButton = document.getElementById("play-button");
playButton.addEventListener("click", gameStart)
titleScreen.addEventListener("keydown", function(e) {
    e.preventDefault();
    if ((e.code == "Enter" || e.code == "Space") && paused) {
        gameStart();
    }
});
playButton.focus();
function gameStart() {
    paused = false;
    if (document.getElementById("david-mode-toggle").checked) {
        david.visible = true;
    }
    titleScreen.y_offset = 0;
    titleScreen.style.opacity = 1.00;
    addHandler(titleScreen, function() {
        titleScreen.style.opacity -= 0.01
        titleScreen.style.top = titleScreen.y_offset+"px";
        titleScreen.y_offset = lerp(titleScreen.y_offset, -screen.height-250, 0.05);
        if(titleScreen.style.opacity <= 0) {
            titleScreen.style.display = "none";
            titleScreen.remove();
        }
    });
}
// resize viewport automatically
window.addEventListener("resize", function() { // resize 3d view when window resizes
    var width = window.innerWidth;
    var height = window.innerHeight;
    renderer.setSize(width,height);
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
})
// input listening
document.addEventListener('keydown', function(event) { // handle key presses
    key[event.code] = true;
});
document.addEventListener('keyup', function(event) { // handle key presses
    key[event.code] = false;
});
document.addEventListener('visibilitychange', function(){ // get delta when page visibility changes to prevent delta buildup while page is unfocused
    clock.getDelta();
})

touchControls.addEventListener("touchstart", touchHandler);
touchControls.addEventListener("touchmove", touchHandler);
touchControls.addEventListener("touchend",function(){touchX=0;touchY=0; touchJoystick.style.left = "0px";touchJoystick.style.top = "5px";}) // reset joystick when finger leaves touchscreen
function touchHandler(e) { // touch handler for joystick touch controls
    if(e.touches) {
        touchX = (e.touches[0].pageX - this.offsetLeft - touchControls.clientWidth / 2)
        touchY = (e.touches[0].pageY - this.offsetTop - touchControls.clientHeight / 2)
        touchJoystick.style.left = touchX + "px";
        touchJoystick.style.top = touchY + "px";
        let newtouch = new THREE.Vector2(touchX,touchY).normalize()
        touchX = newtouch.x;
        touchY = newtouch.y;
        e.preventDefault();
    }   
}

function addHandler(obj,handler) { // add function to handlers array
    if (typeof handler == "function") {
        handler.obj = obj
        handlers.push(handler);
        obj.handlers || (obj.handlers = []);
        obj.handlers.push(handler)
    }
}
function removeHandler(handler) { // remove function from handlers array
    var index = handlers.indexOf(handler);
    if (index > -1) {
        handlers.splice(index,1)
        handlers.splice(handler.obj.handlers.indexOf(handler),1);
    }
}
