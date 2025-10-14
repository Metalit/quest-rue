import { Icon } from "solid-heroicons";
import { star as starOutline } from "solid-heroicons/outline";
import { star as starFilled } from "solid-heroicons/solid";
import { memberPins, setMemberPins } from "../../global/settings";

export function CellTextLabel(props: { text: string; class?: string }) {
  return (
    <span
      class={`mono pl-1 overflow-clip text-ellipsis ${props.class}`}
      title={props.text}
    >
      {props.text}
    </span>
  );
}

export function CellPinButton(props: { pinsKey: string; pinId: string }) {
  const pins = () => memberPins[props.pinsKey] ?? [];

  const pinned = () => pins().includes(props.pinId);

  const toggle = () => {
    if (pinned())
      // eslint-disable-next-line solid/reactivity
      setMemberPins(props.pinsKey, (pins) =>
        pins.filter((id) => id != props.pinId),
      );
    else setMemberPins(props.pinsKey, pins().concat([props.pinId]));
  };

  return (
    <div class="hidden parent-hover:block">
      <button class="btn btn-ghost btn-square btn-sm" onClick={toggle}>
        <Icon path={pinned() ? starFilled : starOutline} />
      </button>
    </div>
  );
}
