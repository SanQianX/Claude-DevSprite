/**
 * TeamStatusPanel Component Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TeamStatusPanel from '../../src/components/teams/TeamStatusPanel.vue';

describe('TeamStatusPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should render three team indicators', () => {
    const wrapper = mount(TeamStatusPanel);

    const indicators = wrapper.findAll('.team-indicator');
    expect(indicators).toHaveLength(3);
  });

  it('should display team names', () => {
    const wrapper = mount(TeamStatusPanel);

    const names = wrapper.findAll('.team-name');
    expect(names[0].text()).toBe('Lead');
    expect(names[1].text()).toBe('Dev');
    expect(names[2].text()).toBe('Test');
  });

  it('should render abort button', () => {
    const wrapper = mount(TeamStatusPanel);

    expect(wrapper.find('.abort-btn').exists()).toBe(true);
    expect(wrapper.find('.abort-btn').text()).toBe('中止所有');
  });

  it('should show status dots for each team', () => {
    const wrapper = mount(TeamStatusPanel);

    const dots = wrapper.findAll('.status-dot');
    expect(dots).toHaveLength(3);
  });

  it('should have correct panel structure', () => {
    const wrapper = mount(TeamStatusPanel);

    expect(wrapper.find('.team-status-panel').exists()).toBe(true);
    expect(wrapper.find('.team-status-panel').findAll('.team-indicator')).toHaveLength(3);
    expect(wrapper.find('.team-status-panel').find('.abort-btn').exists()).toBe(true);
  });

  it('should render with correct CSS classes', () => {
    const wrapper = mount(TeamStatusPanel);

    const panel = wrapper.find('.team-status-panel');
    expect(panel.exists()).toBe(true);
  });
});
