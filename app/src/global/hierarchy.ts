import { createStore, reconcile } from "solid-js/store";
import { ProtoGameObject } from "../proto/unity";
import { sendPacketResult } from "./packets";
import { GetAllGameObjectsResult } from "../proto/qrue";
import { bigToString } from "./utils";

// addresses are transform adresses
interface GameObjectsStore {
  objects: { [address: string]: ProtoGameObject };
  children: { [address: string]: string[] };
}

export const [gameObjectsStore, setGameObjectsStore] =
  createStore<GameObjectsStore>({
    objects: {},
    children: {},
  });

export async function updateGameObjects() {
  const { objects } = await sendPacketResult<GetAllGameObjectsResult>({
    getAllGameObjects: {},
  })[0];

  const newObjects: GameObjectsStore["objects"] = {};
  const newChildren: GameObjectsStore["children"] = {};

  objects.forEach((object) => {
    const address = bigToString(object.transform!.address);
    newObjects[address] = object;
    if (!object.transform?.parent) return;
    const parent = bigToString(object.transform.parent);
    if (!(parent in newChildren)) newChildren[parent] = [];
    newChildren[parent].push(address);
  });

  // reconcile will also remove any removed values, in addition to reducing updates
  setGameObjectsStore(
    reconcile({ objects: newObjects, children: newChildren }),
  );
}
