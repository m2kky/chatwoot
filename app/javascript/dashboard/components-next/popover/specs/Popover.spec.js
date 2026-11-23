import { flushPromises, mount } from '@vue/test-utils';
import { h, ref } from 'vue';
import Popover from '../Popover.vue';
import Dialog from 'dashboard/components-next/dialog/Dialog.vue';

const belowMd = ref(false);

vi.mock('dashboard/composables/store', () => ({
  useMapGetter: () => ref(false),
}));

vi.mock('@vueuse/core', async importOriginal => ({
  ...(await importOriginal()),
  useBreakpoints: () => ({ smaller: () => belowMd }),
}));

describe('Popover', () => {
  let wrapper;

  const mountPopover = (props = {}, options = {}) => {
    wrapper = mount(Popover, {
      props,
      slots: {
        default: '<button data-test="trigger">Open</button>',
        content: params =>
          h(
            'button',
            { 'data-test': 'panel-action', onClick: params.hide },
            'Panel'
          ),
      },
      global: {
        stubs: { teleport: true },
      },
      attachTo: document.body,
      ...options,
    });
    return wrapper;
  };

  const openPopover = async () => {
    await wrapper.find('[data-test="trigger"]').trigger('click');
    await flushPromises();
  };

  const desktopPopover = () => wrapper.find('.fixed[data-popover-content]');
  const mobileBackdrop = () => wrapper.find('[data-popover-backdrop]');

  beforeEach(() => {
    belowMd.value = false;
  });

  afterEach(() => {
    wrapper?.unmount();
    document.body.innerHTML = '';
  });

  describe('rendering and toggling', () => {
    it('renders the trigger slot and keeps the content hidden initially', () => {
      mountPopover();
      expect(wrapper.find('[data-test="trigger"]').exists()).toBe(true);
      expect(desktopPopover().exists()).toBe(false);
      expect(mobileBackdrop().exists()).toBe(false);
    });

    it('opens on trigger click and emits show', async () => {
      mountPopover();
      await openPopover();
      expect(desktopPopover().exists()).toBe(true);
      expect(wrapper.emitted('show')).toHaveLength(1);
      expect(wrapper.emitted('hide')).toBeUndefined();
    });

    it('renders the content slot inside the popover', async () => {
      mountPopover();
      await openPopover();
      expect(desktopPopover().find('[data-test="panel-action"]').exists()).toBe(
        true
      );
    });

    it('closes on a second trigger click and emits hide exactly once', async () => {
      mountPopover();
      await openPopover();
      await wrapper.find('[data-test="trigger"]').trigger('click');
      expect(desktopPopover().exists()).toBe(false);
      expect(wrapper.emitted('hide')).toHaveLength(1);
    });
  });

  describe('content slot hide', () => {
    it('closes when the slot invokes the provided hide function', async () => {
      mountPopover();
      await openPopover();
      await wrapper.find('[data-test="panel-action"]').trigger('click');
      expect(desktopPopover().exists()).toBe(false);
      expect(wrapper.emitted('hide')).toHaveLength(1);
    });
  });

  describe('exposed methods', () => {
    it('opens via show and closes via hide', async () => {
      mountPopover();
      await wrapper.vm.show();
      await flushPromises();
      expect(desktopPopover().exists()).toBe(true);
      wrapper.vm.hide();
      await flushPromises();
      expect(desktopPopover().exists()).toBe(false);
      expect(wrapper.emitted('show')).toHaveLength(1);
      expect(wrapper.emitted('hide')).toHaveLength(1);
    });

    it('toggles via toggle', async () => {
      mountPopover();
      await wrapper.vm.toggle();
      await flushPromises();
      expect(desktopPopover().exists()).toBe(true);
      await wrapper.vm.toggle();
      await flushPromises();
      expect(desktopPopover().exists()).toBe(false);
    });

    it('does not emit hide when already closed', async () => {
      mountPopover();
      wrapper.vm.hide();
      await flushPromises();
      expect(wrapper.emitted('hide')).toBeUndefined();
    });
  });

  describe('escape key', () => {
    const pressEscape = target =>
      (target || document).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );

    it('closes on Escape while open', async () => {
      mountPopover();
      await openPopover();
      pressEscape();
      await flushPromises();
      expect(desktopPopover().exists()).toBe(false);
      expect(wrapper.emitted('hide')).toHaveLength(1);
    });

    it('does nothing on Escape while closed', async () => {
      mountPopover();
      await flushPromises();
      pressEscape();
      await flushPromises();
      expect(wrapper.emitted('hide')).toBeUndefined();
    });

    it('closes on Escape pressed inside its own content', async () => {
      mountPopover();
      await openPopover();
      pressEscape(wrapper.find('[data-test="panel-action"]').element);
      await flushPromises();
      expect(desktopPopover().exists()).toBe(false);
    });

    it('stays open on Escape pressed inside a nested overlay', async () => {
      mountPopover();
      await openPopover();
      const overlay = document.createElement('dialog');
      overlay.className = 'ProseMirror-prompt-backdrop';
      document.body.appendChild(overlay);
      pressEscape(overlay);
      await flushPromises();
      expect(desktopPopover().exists()).toBe(true);
      expect(wrapper.emitted('hide')).toBeUndefined();
    });
  });

  describe('click outside', () => {
    it('closes when clicking outside', async () => {
      mountPopover();
      await openPopover();
      document.body.click();
      await flushPromises();
      expect(desktopPopover().exists()).toBe(false);
      expect(wrapper.emitted('hide')).toHaveLength(1);
    });

    it('stays open when clicking inside the content', async () => {
      mountPopover();
      await openPopover();
      desktopPopover().element.click();
      await flushPromises();
      expect(desktopPopover().exists()).toBe(true);
      expect(wrapper.emitted('hide')).toBeUndefined();
    });
  });

  describe('mobile view', () => {
    it('renders a centered modal with backdrop below the md breakpoint', async () => {
      belowMd.value = true;
      mountPopover();
      await openPopover();
      expect(mobileBackdrop().exists()).toBe(true);
      expect(mobileBackdrop().find('[data-test="panel-action"]').exists()).toBe(
        true
      );
      expect(desktopPopover().exists()).toBe(false);
    });

    it('keeps the anchored popover below md when disableMobileView is set', async () => {
      belowMd.value = true;
      mountPopover({ disableMobileView: true });
      await openPopover();
      expect(mobileBackdrop().exists()).toBe(false);
      expect(desktopPopover().exists()).toBe(true);
    });
  });

  describe('native dialog teleport target', () => {
    it('keeps desktop content in the dialog containing its trigger', async () => {
      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);
      mountPopover(
        {},
        { attachTo: dialog, global: { stubs: { teleport: false } } }
      );
      await openPopover();

      expect(dialog.querySelector('[data-popover-content]')).not.toBeNull();
    });

    it('keeps the mobile backdrop in the dialog containing its trigger', async () => {
      belowMd.value = true;
      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);
      mountPopover(
        {},
        { attachTo: dialog, global: { stubs: { teleport: false } } }
      );
      await openPopover();

      expect(dialog.querySelector('[data-popover-backdrop]')).not.toBeNull();
    });

    it('uses the nearest dialog when dialogs are nested', async () => {
      const outerDialog = document.createElement('dialog');
      const innerDialog = document.createElement('dialog');
      outerDialog.appendChild(innerDialog);
      document.body.appendChild(outerDialog);
      mountPopover(
        {},
        { attachTo: innerDialog, global: { stubs: { teleport: false } } }
      );
      await openPopover();

      expect(
        document.querySelector('[data-popover-content]').closest('dialog')
      ).toBe(innerDialog);
    });

    it('continues teleporting to body when the trigger is outside a dialog', async () => {
      mountPopover({}, { global: { stubs: { teleport: false } } });
      await openPopover();

      const panel = document.querySelector('[data-popover-content]');
      expect(panel).not.toBeNull();
      expect(panel.closest('dialog')).toBeNull();
      expect(wrapper.element.contains(panel)).toBe(false);
    });

    it('prevents native Escape cancellation when dismissing a dialog popover', async () => {
      const dialog = document.createElement('dialog');
      document.body.appendChild(dialog);
      mountPopover(
        {},
        { attachTo: dialog, global: { stubs: { teleport: false } } }
      );
      await openPopover();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.querySelector('[data-test="panel-action"]').dispatchEvent(event);
      await flushPromises();

      expect(event.defaultPrevented).toBe(true);
      expect(document.querySelector('[data-popover-content]')).toBeNull();
    });
  });

  describe('popover interactions inside Dialog', () => {
    const mountDialogPopover = async () => {
      wrapper = mount(
        {
          components: { Dialog, Popover },
          template: `<Dialog ref="dialog" :show-confirm-button="false" :show-cancel-button="false">
          <input data-test="draft" value="Unsaved draft" />
          <Popover>
            <button data-test="trigger">Choose</button>
            <template #content><button data-test="panel-action">Option</button></template>
          </Popover>
        </Dialog>`,
        },
        { attachTo: document.body, global: { stubs: { teleport: false } } }
      );
      const dialog = document.querySelector('dialog');
      dialog.showModal = () => {
        dialog.open = true;
      };
      dialog.close = () => {
        dialog.open = false;
      };
      wrapper.findComponent(Dialog).vm.open();
      await flushPromises();
      document.querySelector('[data-test="trigger"]').click();
      await flushPromises();
      await new Promise(resolve => {
        setTimeout(resolve, 0);
      });
      return dialog;
    };

    it('keeps the dialog open when clicking its teleported popover content', async () => {
      const dialog = await mountDialogPopover();
      document
        .querySelector('[data-test="panel-action"]')
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      document.querySelector('[data-test="panel-action"]').click();
      await flushPromises();

      expect(dialog.open).toBe(true);
      expect(wrapper.findComponent(Dialog).emitted('close')).toBeUndefined();
    });

    it('dismisses a mobile popover backdrop without discarding the dialog draft', async () => {
      belowMd.value = true;
      const dialog = await mountDialogPopover();
      document
        .querySelector('[data-popover-backdrop]')
        .dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      document.querySelector('[data-popover-backdrop]').click();
      await flushPromises();

      expect(document.querySelector('[data-popover-content]')).toBeNull();
      expect(dialog.open).toBe(true);
      expect(dialog.querySelector('[data-test="draft"]').value).toBe(
        'Unsaved draft'
      );
      expect(wrapper.findComponent(Dialog).emitted('close')).toBeUndefined();
    });

    it('still closes when clicking the native dialog backdrop', async () => {
      const dialog = await mountDialogPopover();
      dialog.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      dialog.click();
      await flushPromises();

      expect(dialog.open).toBe(false);
      expect(wrapper.findComponent(Dialog).emitted('close')).toHaveLength(1);
    });
  });

  describe('close on scroll', () => {
    const scrollWithTriggerMovedBy = async offset => {
      await openPopover();
      wrapper.find('span').element.getBoundingClientRect = () => ({
        top: offset,
      });
      document.dispatchEvent(new Event('scroll'));
      await flushPromises();
    };

    it('closes when the trigger drifts beyond the threshold', async () => {
      mountPopover();
      await scrollWithTriggerMovedBy(100);
      expect(desktopPopover().exists()).toBe(false);
      expect(wrapper.emitted('hide')).toHaveLength(1);
    });

    it('stays open for small drift within the threshold', async () => {
      mountPopover();
      await scrollWithTriggerMovedBy(10);
      expect(desktopPopover().exists()).toBe(true);
    });

    it('stays open when closeOnScroll is disabled', async () => {
      mountPopover({ closeOnScroll: false });
      await scrollWithTriggerMovedBy(100);
      expect(desktopPopover().exists()).toBe(true);
    });
  });
});
