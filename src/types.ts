export interface IOnMove {
  type: string;
  positionX: number;
  positionY: number;
  scale: number;
  zoomCurrentDistance: number;
}

export interface IOnTap {
  locationX: number;
  locationY: number;
  pageX: number;
  pageY: number;
}
