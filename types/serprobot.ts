/** SerpRobot API types (minimal; extend from actual API responses). */

export interface SerpRobotProject {
  id: string;
  name: string;
}

export interface SerpRobotKeyword {
  id: string;
  phrase: string;
  project_id?: string;
  position?: number;
  url?: string;
}

export interface SerpRobotCredit {
  balance?: number;
  credits?: number;
}
