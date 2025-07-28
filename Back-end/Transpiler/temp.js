function ACTION_NAME(propsARR) {
  propsARR[0].METHOD_NAME(PARAMS);
}

class MyProp extends mixClasses([
  ObjectAnimationSystem_INS.CORE_3d_PROPSsceneSYS.Prop,
]) {
  // console.log("hello world");
}

class MyProp1 extends mixClasses([
  ObjectAnimationSystem_INS.CORE_3d_PROPSsceneSYS.Prop,
]) {
  // console.log("hello world");
}

var Alias = new MyProp(params);

var defaultGredientMap = [];
var OAS_OBJ = {
  defaultGredientMap: defaultGredientMap[0],
  scenes: [{ PropsDef: [Alias], actions: [] }],
};

// push to the anim (renderer) pipeline
currentANIM = ObjectAnimationSystem_INS.main(OAS_OBJ).init(60, true);
