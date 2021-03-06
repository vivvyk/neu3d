import { Neu3D } from './neu3d';
/**
* Function taken from THREE.SceneUtils
* 
* @param geometry 
* @param materials 
* 
* ### Note
* reason for extracting this method is that loading THREE.SceneUtils
* always returns `module has been moved to ...` error.
*/
function createMultiMaterialObject(geometry, materials) {
  
  let group = new THREE.Group();
  
  for (let i = 0, l = materials.length; i < l; i++) {
    group.add(new THREE.Mesh(geometry, materials[i]));
  }
  
  return group;
}

function size(obj){
  let count = 0;
  for(let i in obj){
    count++;
  }

  return count;
}

function traceback(swcObj, ind, path){
  path.push(parseInt(ind));

  if(ind == 1){
    return path.reverse();
  }

  return traceback(swcObj, swcObj[ind].parent, path);
}

function obtainPaths(swcObj){
  let paths = [];
  for(let i in swcObj){

    if(i == 1)
      continue;

    if(swcObj[i].parent != i-1){
      paths.push(traceback(swcObj, i-1, []));
    }
    
    if(i == size(swcObj)){
      paths.push(traceback(swcObj, i, []));
    }
  }
  return paths;
}
/**
* Register Object to `meshDict`
* @param {*} key 
* @param {*} unit 
* @param {*} object 
*/
Neu3D.prototype._registerObject = function(key, unit, object) {
  object.rid = key; // needed rid for raycaster reference
  unit['rid'] = key;
  unit['object'] = object;
  unit['pinned'] = false;
  // unit['opacity'] = -1.;
  if (!unit.hasOwnProperty('position')) {
    unit['position'] = new THREE.Vector3(0.5 * (unit.boundingBox.minX + unit.boundingBox.maxX), 0.5 * (unit.boundingBox.minY + unit.boundingBox.maxY), 0.5 * (unit.boundingBox.minZ + unit.boundingBox.maxZ));
  }
  // TODO: move the code below to a function
  if (!('morph_type' in unit) || (unit['morph_type'] != 'Synapse SWC')) {
    if (this.settings.defaultOpacity !== 1){
      for (let i = 0; i < unit['object'].children.length; i++){
        unit['object'].children[i].material.opacity = this.settings.defaultOpacity;
      }
    }
  }
  else {
    if (this.settings.synapseOpacity !== 1){
      for (let i = 0; i < unit['object'].children.length; i++){
        unit['object'].children[i].material.opacity = this.settings.synapseOpacity;
      }
    }
  }
  this.meshDict[key] = unit;
}


/** TODO: Add comment
 * @param {*} key 
 * @param {*} unit 
 * @param {*} visibility 
 */
Neu3D.prototype.loadMeshCallBack = function(key, unit, visibility) {
  return (jsonString) => {
    let json = JSON.parse(jsonString);
    let color = unit['color'];
    let geometry = new THREE.Geometry();
    let vtx = json['vertices'];
    let idx = json['faces'];
    for (let j = 0; j < vtx.length / 3; j++) {
      let x = parseFloat(vtx[3 * j + 0]);
      let y = parseFloat(vtx[3 * j + 1]);
      let z = parseFloat(vtx[3 * j + 2]);
      geometry.vertices.push(new THREE.Vector3(x, y, z));
      this.updateObjectBoundingBox(unit, x, y, z);
      this.updateBoundingBox(x, y, z);
    }
    for (let j = 0; j < idx.length / 3; j++) {
      geometry.faces.push(new THREE.Face3(parseInt(idx[3 * j + 0]), parseInt(idx[3 * j + 1]), parseInt(idx[3 * j + 2])));
    }
    geometry.mergeVertices();
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    let materials = [
      //new THREE.MeshPhongMaterial( { color: color, flatShading: true, shininess: 0, transparent: true } ),
      new THREE.MeshLambertMaterial({ color: color, transparent: true, side: 2, flatShading: true }),
      new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true })
    ];
    if (!this.settings.meshWireframe){
      for (let i = 0; i < this.groups.back.children.length; i++)
        this.groups.back.children[i].children[1].visible = false;
    }

    let object = createMultiMaterialObject(geometry, materials);  
    object.visible = visibility;
    this._registerObject(key, unit, object);
  };
}



/** TODO: Add comment
* @param {*} key 
* @param {*} unit 
* @param {*} visibility 
*/
Neu3D.prototype.loadSWCCallBack = function(key, unit, visibility) {
  return (swcString) => {
    /** process string */
    swcString = swcString.replace(/\r\n/g, "\n");
    let swcLine = swcString.split("\n");
    let len = swcLine.length;
    let swcObj = {};
    
    swcLine.forEach((e)=> {
      let seg = e.split(' ');
      if (seg.length == 7) {
        swcObj[parseInt(seg[0])] = {
          'type': parseInt(seg[1]),
          'x': parseFloat(seg[2]),
          'y': parseFloat(seg[3]),
          'z': parseFloat(seg[4]),
          'radius': parseFloat(seg[5]),
          'parent': parseInt(seg[6]),
        };
      }
    });
    
    let color = unit['color']
    let object = new THREE.Object3D();
    let pointGeometry = undefined;
    let mergedGeometry = undefined;
    let geometry = undefined;
    let sphereGeometry = undefined;
    /*
    for (let idx in swcObj) {
      let c = swcObj[idx];
      if (idx == Math.round(len / 2) && unit.position == undefined)
      unit.position = new THREE.Vector3(c.x, c.y, c.z);
      this.updateObjectBoundingBox(unit, c.x, c.y, c.z);
      this.updateBoundingBox(c.x, c.y, c.z);
      if (c.parent != -1) {
        let p = swcObj[c.parent];
        if (this.settings.neuron3d) {
          if (mergedGeometry == undefined){
            mergedGeometry = new THREE.Geometry();
          }
          let d = new THREE.Vector3((p.x - c.x), (p.y - c.y), (p.z - c.z));
          if (!p.radius || !c.radius){
            geometry = new THREE.CylinderGeometry(this.settings.defaultRadius, this.settings.defaultRadius, d.length(), 4, 1, 0);
          }else{
            geometry = new THREE.CylinderGeometry(p.radius, c.radius, d.length(), 8, 1, 0);
          }
          geometry.translate(0, 0.5 * d.length(), 0);
          geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
          geometry.lookAt(d.clone());
          geometry.translate((c.x + c.x) / 2, -0.0 * d.length() + (c.y + c.y) / 2, (c.z + c.z) / 2);
          mergedGeometry.merge(geometry);
          geometry = null;
          
          if (this.settings.neuron3dMode == 2) {
            geometry = new THREE.SphereGeometry(c.radius, 8, 8);
            geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
            geometry.lookAt(d);
            geometry.translate((c.x + c.x) / 2, (c.y + c.y) / 2, (c.z + c.z) / 2);
            mergedGeometry.merge(geometry);
            geometry = null;
          }else if (this.settings.neuron3dMode == 3) {
            if (p.parent != -1) {
              let p2 = swcObj[p.parent];
              let a = new THREE.Vector3(0.9 * p.x + 0.1 * p2.x, 0.9 * p.y + 0.1 * p2.y, 0.9 * p.z + 0.1 * p2.z);
              let b = new THREE.Vector3(0.9 * p.x + 0.1 * c.x, 0.9 * p.y + 0.1 * c.y, 0.9 * p.z + 0.1 * c.z);
              let curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(p.x, p.y, p.z), b);
              geometry = new THREE.TubeGeometry(curve, 8, p.radius, 4, false);
              mergedGeometry.merge(geometry);
              geometry = null;
            }
          }
        } else {
          if (geometry == undefined)
          geometry = new THREE.Geometry();
          geometry.vertices.push(new THREE.Vector3(c.x, c.y, c.z));
          geometry.vertices.push(new THREE.Vector3(p.x, p.y, p.z));
          geometry.colors.push(color);
          geometry.colors.push(color);
        }
      }
      if (c.type == 1) {
        if (c.radius){
          sphereGeometry = new THREE.SphereGeometry(c.radius, 8, 8);
        }else{
          sphereGeometry = new THREE.SphereGeometry(this.settings.defaultSomaRadius, 8, 8);
        }
        sphereGeometry.translate(c.x, c.y, c.z);
        let sphereMaterial = new THREE.MeshLambertMaterial({ color: color, transparent: true });
        object.add(new THREE.Mesh(sphereGeometry, sphereMaterial));
        unit['position'] = new THREE.Vector3(c.x, c.y, c.z);
      }
      if (c.type == -1) {
        if (this.settings.synapseMode == true) {
          if (mergedGeometry == undefined){
            mergedGeometry = new THREE.Geometry();
          }
          if (c.radius){
            sphereGeometry = new THREE.SphereGeometry(c.radius, 8, 8);
          }else{
            sphereGeometry = new THREE.SphereGeometry(this.settings.defaultSynapseRadius, 8, 8);
          }
          sphereGeometry.translate(c.x, c.y, c.z);
          //let sphereMaterial = new THREE.MeshLambertMaterial( {color: color, transparent: true} );
          //object.add(new THREE.Mesh( sphereGeometry, sphereMaterial));
          mergedGeometry.merge(sphereGeometry);
          unit['position'] = new THREE.Vector3(c.x, c.y, c.z);
        } else {
          if (pointGeometry == undefined)
          pointGeometry = new THREE.Geometry();
          pointGeometry.vertices.push(new THREE.Vector3(c.x, c.y, c.z));
        }
      }
    }
    */
    if (pointGeometry) {
      //let pointBufferGeometry = new THREE.SphereBufferGeometry().fromGeometry( pointGeometry );
      let pointMaterial = new THREE.PointsMaterial({ color: color, size: this.settings.defaultSynapseRadius, lights: true });
      let points = new THREE.Points(pointGeometry, pointMaterial);
      object.add(points);
    }
    if (mergedGeometry) {
      let material = new THREE.MeshLambertMaterial({ color: color, transparent: true });
      //let modifier = new THREE.SimplifyModifier();
      //simplified = modifier.modify( mergedGeometry, geometry.vertices.length * 0.25 | 0 )
      //var bufferMergedGeometry = new THREE.BufferGeometry().fromGeometry( mergedGeometry );
      let mesh = new THREE.Mesh(mergedGeometry, material);
      //let mesh = new THREE.Mesh(simplified, material);
      object.add(mesh);
    }
    if (true) {
      //var bufferGeometry = new THREE.BufferGeometry().fromGeometry( geometry );

      let material = new THREE.MeshLambertMaterial({ color: color, transparent: true });
      
      let paths = obtainPaths(swcObj);
      let mergedGeometry = new THREE.Geometry();

      let cached = [];
      for(var i = 0; i < paths.length; i++){
        let points = [];
        let path = paths[i];
        let counter = 0;
        for(var j =0; j < path.length; j++){
          if(cached.includes(path[j])){
             continue;
          }
          cached.push(path[j]);
          let idx = path[j];
          let c = swcObj[idx];
          if(c.parent != -1){
            if(counter == 0){
              let p = swcObj[c.parent];
              points.push(new THREE.Vector3(p.x, p.y, p.z));
            }
            points.push(new THREE.Vector3(c.x, c.y, c.z));
          }
          counter++;
        }
        var curve = new THREE.CatmullRomCurve3(points, false);
        let path_geo = new THREE.TubeGeometry(curve, 80, 1, 20, false);
        mergedGeometry.merge(path_geo);
      }

      let mesh = new THREE.Mesh(mergedGeometry, material);
      object.add(mesh);

      //let material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors, transparent: true, color: color, linewidth: 3 });
      //object.add(new THREE.LineSegments(geometry, material));
    }
    object.visible = visibility;
    this._registerObject(key, unit, object);
  };
}

/** TODO: Add comment
* 
* @param {*} key 
* @param {*} unit 
* @param {*} visibility 
*/
Neu3D.prototype.loadMorphJSONCallBack = function(key, unit, visibility) {
  return () => {
    /*
    * process string
    */
    let swcObj = {};
    let len = unit['sample'].length;
    for (let j = 0; j < len; j++) {
      swcObj[parseInt(unit['sample'][j])] = {
        'type': parseInt(unit['identifier'][j]),
        'x': parseFloat(unit['x'][j]),
        'y': parseFloat(unit['y'][j]),
        'z': parseFloat(unit['z'][j]),
        'radius': parseFloat(unit['r'][j]),
        'parent': parseInt(unit['parent'][j]),
      };
    }
    let color = unit['color'];
    let object = new THREE.Object3D();
    let pointGeometry = undefined;
    let mergedGeometry = undefined;
    let geometry = undefined;
    let sphereGeometry = undefined;
    for (let idx in swcObj) {
      let c = swcObj[idx];
      if (idx == Math.round(len / 2) && unit.position == undefined){
        unit.position = new THREE.Vector3(c.x, c.y, c.z);
      }
      this.updateObjectBoundingBox(unit, c.x, c.y, c.z);
      this.updateBoundingBox(c.x, c.y, c.z);
      if (c.parent != -1) {
        let p = swcObj[c.parent];
        if (this.settings.neuron3d) {
          if (mergedGeometry == undefined){
            mergedGeometry = new THREE.Geometry();
          }
          let d = new THREE.Vector3((p.x - c.x), (p.y - c.y), (p.z - c.z));
          if (!p.radius || !c.radius){
            geometry = new THREE.CylinderGeometry(this.settings.defaultRadius, this.settings.defaultRadius, d.length(), 4, 1, 0);
          } else {
            geometry = new THREE.CylinderGeometry(p.radius, c.radius, d.length(), 8, 1, 0);
          }
          geometry.translate(0, 0.5 * d.length(), 0);
          geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
          geometry.lookAt(d.clone());
          geometry.translate((c.x + c.x) / 2, -0.0 * d.length() + (c.y + c.y) / 2, (c.z + c.z) / 2);
          mergedGeometry.merge(geometry);
          geometry = null;
          if (this.settings.neuron3dMode == 2) {
            geometry = new THREE.SphereGeometry(c.radius, 8, 8);
            geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI / 2));
            geometry.lookAt(d);
            geometry.translate((c.x + c.x) / 2, (c.y + c.y) / 2, (c.z + c.z) / 2);
            mergedGeometry.merge(geometry);
            geometry = null;
          } else if (this.settings.neuron3dMode == 3) {
            if (p.parent != -1) {
              p2 = swcObj[p.parent];
              let a = new THREE.Vector3(0.9 * p.x + 0.1 * p2.x, 0.9 * p.y + 0.1 * p2.y, 0.9 * p.z + 0.1 * p2.z);
              let b = new THREE.Vector3(0.9 * p.x + 0.1 * c.x, 0.9 * p.y + 0.1 * c.y, 0.9 * p.z + 0.1 * c.z);
              let curve = new THREE.QuadraticBezierCurve3(a, new THREE.Vector3(p.x, p.y, p.z), b);
              geometry = new THREE.TubeGeometry(curve, 8, p.radius, 4, false);
              mergedGeometry.merge(geometry);
              geometry = null;
            }
          }
        } else {
          if (geometry == undefined){
            geometry = new THREE.Geometry();
          }
          geometry.vertices.push(new THREE.Vector3(c.x, c.y, c.z));
          geometry.vertices.push(new THREE.Vector3(p.x, p.y, p.z));
          geometry.colors.push(color);
          geometry.colors.push(color);
        }
      }
      if (c.type == 1) {
        if (c.radius){
          sphereGeometry = new THREE.SphereGeometry(c.radius, 8, 8);
        }else{
          sphereGeometry = new THREE.SphereGeometry(this.settings.defaultSomaRadius, 8, 8);
        }
        sphereGeometry.translate(c.x, c.y, c.z);
        let sphereMaterial = new THREE.MeshLambertMaterial({ color: color, transparent: true });
        object.add(new THREE.Mesh(sphereGeometry, sphereMaterial));
        unit['position'] = new THREE.Vector3(c.x, c.y, c.z);
      }
      if (c.type == -1) {
        if (this.settings.synapseMode == true) {
          if (mergedGeometry == undefined){
            mergedGeometry = new THREE.Geometry();
          }
          if (c.radius){
            sphereGeometry = new THREE.SphereGeometry(c.radius, 8, 8);
          }else {
            sphereGeometry = new THREE.SphereGeometry(this.settings.defaultSynapseRadius, 8, 8);
          }
          sphereGeometry.translate(c.x, c.y, c.z);
          //let sphereMaterial = new THREE.MeshLambertMaterial( {color: color, transparent: true} );
          //object.add(new THREE.Mesh( sphereGeometry, sphereMaterial));
          mergedGeometry.merge(sphereGeometry);
          unit['position'] = new THREE.Vector3(c.x, c.y, c.z);
        } else {
          if (pointGeometry == undefined){
            pointGeometry = new THREE.Geometry();
          }
          pointGeometry.vertices.push(new THREE.Vector3(c.x, c.y, c.z));
        }
      }
    }
    if (pointGeometry) {
      let pointMaterial = new THREE.PointsMaterial({ color: color, size: this.settings.defaultSynapseRadius, lights: true });
      let points = new THREE.Points(pointGeometry, pointMaterial);
      object.add(points);
    }
    if (mergedGeometry) {
      let material = new THREE.MeshLambertMaterial({ color: color, transparent: true });
      //let modifier = new THREE.SimplifyModifier();
      //simplified = modifier.modify( mergedGeometry, geometry.vertices.length * 0.25 | 0 )
      //var bufferMergedGeometry = new THREE.BufferGeometry().fromGeometry( geometry );
      let mesh = new THREE.Mesh(geometry, material);
      //let mesh = new THREE.Mesh(simplified, material);
      object.add(mesh);
    }
    if (geometry) {
      //var bufferGeometry = new THREE.BufferGeometry().fromGeometry( geometry );
      let material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors, transparent: true, color: color });
      object.add(new THREE.LineSegments(geometry, material));
    }
    object.visible = visibility;
    this._registerObject(key, unit, object);
    /* delete morpology data */
    delete unit['identifier'];
    delete unit['x'];
    delete unit['y'];
    delete unit['z'];
    delete unit['r'];
    delete unit['parent'];
    delete unit['sample'];
    delete unit['type'];
  };
}


export { Neu3D };
