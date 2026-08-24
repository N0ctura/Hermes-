export interface MissionSkin {
  name: string;
  imageUrl: string;
  description?: string;
}

export interface MissionPoll {
  title: string;
  description: string;
  skins: MissionSkin[];
  endDate?: string;
}
