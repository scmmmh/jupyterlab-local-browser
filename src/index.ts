import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';
import { ICommandPalette, WidgetTracker } from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { v4 as uuidv4 } from 'uuid';

import { LocalBrowserWidget } from './widget';

/**
 * Initialization data for the jupyterlab_local_browser extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_local_browser',
  autoStart: true,
  requires: [ICommandPalette, ILayoutRestorer, IStateDB],
  activate: activate
};
export default plugin;

/**
 * Activate the Local Browser widget extension.
 */
async function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  restorer: ILayoutRestorer,
  statedb: IStateDB
): Promise<void> {
  // Add the command to open the local browser
  const command = 'jupyterlab_local_browser:open';
  app.commands.addCommand(command, {
    label: 'Start a new Local Browser',
    execute: (args: any) => {
      // Create the widget
      const uuid = args && args.uuid ? args.uuid : 'lb-' + uuidv4();
      const widget = new LocalBrowserWidget({ uuid: uuid, statedb: statedb });

      // Track the state of the widget for later restoration
      tracker.add(widget);
      app.shell.add(widget, 'main');
      widget.content.update();

      // Activate the widget
      app.shell.activateById(widget.id);
    }
  });

  // Add the command to the palette.
  palette.addItem({ command, category: 'Local Browser' });

  // Track and restore the widget state
  const tracker = new WidgetTracker<LocalBrowserWidget>({
    namespace: 'local_browser'
  });

  restorer.restore(tracker, {
    command,
    name: obj => obj.node.id,
    args: obj => {
      return { uuid: obj.node.id };
    }
  });
}
