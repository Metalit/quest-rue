import { createStore, reconcile } from "solid-js/store";

import { GetAllGameObjectsResult } from "../proto/qrue";
import { ProtoGameObject, ProtoScene } from "../proto/unity";
import { bigToString } from "../utils/misc";
import { sendPacketResult } from "./packets";

// addresses are transform adresses
interface GameObjectsStore {
  objects: { [address: string]: ProtoGameObject };
  children: { [address: string]: string[] };
  roots: string[];
  scenes: ProtoScene[];
}

const [gameObjectsStore, setGameObjectsStore] = createStore<GameObjectsStore>({
  objects: {},
  children: {},
  roots: [],
  scenes: [],
});

export { gameObjectsStore };

export async function updateGameObjects() {
  const { objects, scenes } = await sendPacketResult<GetAllGameObjectsResult>({
    getAllGameObjects: {},
  })[0];

  const processed: GameObjectsStore["objects"] = {};
  const children: GameObjectsStore["children"] = {};
  const roots: GameObjectsStore["roots"] = [];

  objects.forEach((object) => {
    const address = bigToString(object.transform!.address);
    processed[address] = object;
    if (object.transform?.parent) {
      const parent = bigToString(object.transform.parent);
      if (!(parent in children)) children[parent] = [];
      children[parent].push(address);
    } else roots.push(address);
  });

  console.log("updating gameobject store");

  // reconcile will also remove any removed values, in addition to reducing updates
  setGameObjectsStore(
    reconcile({
      objects: processed,
      children,
      roots,
      scenes,
    }),
  );
}
