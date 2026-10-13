import React from 'react';
import { MoreMenu, type MoreMenuItem } from '../../ui/MoreMenu';

export type DiaryMenuItem = MoreMenuItem;

/**
 * "More" for the diary header: the things reception needs now and then (the report, the settings),
 * one tap away instead of crowding the header. The menu itself is the shared MoreMenu (components/ui).
 */
export const DiaryMoreMenu: React.FC<{ items: DiaryMenuItem[] }> = ({ items }) => <MoreMenu items={items} menuLabel="More diary actions" />;

export default DiaryMoreMenu;
