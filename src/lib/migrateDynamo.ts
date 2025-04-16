import { create } from './actions/create';
import { down } from './actions/down';
import { init } from './actions/init';
import { status } from './actions/status';
import { up } from './actions/up';

export const initAction = async () => {
    return init();
};

export const createAction = async (description: string) => {
    return create(description);
};

export const upAction = async (profile: string, env: string) => {
    return up(profile, env);
};

export const downAction = async (profile: string, env: string, downShift: number) => {
    return down(profile, downShift, env);
};

export const statusAction = async (profile: string, env: string) => {
    return status(profile, env);
};
