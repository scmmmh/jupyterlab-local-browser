import {
  MainAreaWidget,
  IFrame,
  ReactWidget,
  ToolbarButton,
} from '@jupyterlab/apputils';
import { refreshIcon, HTMLSelect } from '@jupyterlab/ui-components';
import { IStateDB } from '@jupyterlab/statedb';
import { ServerConnection } from '@jupyterlab/services';
import { URLExt } from '@jupyterlab/coreutils';
import { Message } from '@lumino/messaging';
import React from 'react';

import { webIcon } from './icon';

/**
 * A widget providing a browser for local servers.
 */
export class LocalBrowserWidget extends MainAreaWidget<IFrame> {
  constructor(options: LocalBrowserWidget.IOptions) {
    super({
      content: new IFrame({
        sandbox: ['allow-same-origin', 'allow-scripts']
      }),
    });
    this.id = options.uuid;
    this.title.label = 'Local Browser';
    this.title.closable = true;
    this.title.icon = webIcon;
    this.content.addClass('lb-localBrowser');

    this._modeWidget = new SelectWidget({
      onChange: () => {
        this.toolbarChanged();
      },
      value: 'relative'
    });
    this._modeWidget.values = [
      ['relative', 'Relative Path'],
      ['absolute', 'Absolute Path'],
    ];
    this.toolbar.addItem('mode', this._modeWidget);

    this._portsWidget = new SelectWidget({
      onChange: () => {
        this.toolbarChanged();
      },
      value: '_placeholder'
    });
    this.toolbar.addItem('ports', this._portsWidget);

    this._pathWidget = new PathWidget({
      onChange: () => {
        this.toolbarChanged();
      },
      value: '',
    });
    this.toolbar.addItem('path', this._pathWidget);

    const reloadButton = new ToolbarButton({
      icon: refreshIcon,
      iconLabel: 'Reload',
      onClick: () => {
        const contentDocument = (this.content.node.children[0] as HTMLIFrameElement)
        .contentDocument;
        if (contentDocument) {
          contentDocument.location.reload();
        }
      }
    });
    this.toolbar.addItem('reload', reloadButton);

    this._statedb = options.statedb;

    this._serverSettings = ServerConnection.makeSettings();
    this.content.url = URLExt.join(
      this._serverSettings.baseUrl,
      'jupyterlab-local-browser',
      'public',
      'index.html'
    );

    options.statedb.fetch(options.uuid).then((data: any) => {
      if (data) {
        this._modeWidget.value = data.mode;
        this._portsWidget.value = data.port;
        this._pathWidget.value =
          data.pathname.charAt(0) === '/'
            ? data.pathname.substring(1)
            : data.pathname;
        this.toolbarChanged();
      }
    });

    this.content.node.children[0].addEventListener('load', this);

    this._loadPortsInterval = setInterval(() => {
      this._evtLoadPortsTimer();
    }, 10000);
    this._evtLoadPortsTimer();
  }

  public handleEvent(evt: Event): void {
    if (evt.type === 'load') {
      this._evtIFrameLoad();
    } else {
      console.log(evt);
    }
  }

  public toolbarChanged(): void {
    if (this._portsWidget.value === '_placeholder') {
      this.content.url = URLExt.join(
        this._serverSettings.baseUrl,
        'jupyterlab-local-browser',
        'public',
        'index.html'
      );
    } else {
      this.content.url =
        this._serverSettings.baseUrl +
        'proxy' +
        (this._modeWidget.value === 'absolute' ? '/absolute/' : '/') +
        this._portsWidget.value +
        '/' +
        this._pathWidget.value;
    }
  }

  protected onCloseRequest(msg: Message): void {
    this.content.node.children[0].removeEventListener('load', this);
    clearInterval(this._loadPortsInterval);
    super.onCloseRequest(msg);
  }

  private _evtIFrameLoad(): void {
    const contentDocument = (this.content.node.children[0] as HTMLIFrameElement)
      .contentDocument;
    if (contentDocument) {
      this.title.label = contentDocument.title;
      const iFrameLocation = contentDocument.location;
      if (
        iFrameLocation.pathname.indexOf(
          '/jupyterlab-local-browser/public/index.html'
        ) >= 0
      ) {
        this._statedb.remove(this.id);
      } else {
        let pathname = iFrameLocation.href.substring(this._serverSettings.baseUrl.length);
        const mode = (pathname.startsWith('proxy/absolute/') ? 'absolute' : 'relative');
        if (mode === 'absolute') {
          pathname = pathname.substring(15);
        } else {
          pathname = pathname.substring(6);
        }
        const port = pathname.substring(0, pathname.indexOf('/'));
        pathname = pathname.substring(pathname.indexOf('/'));
        this._statedb.save(this.id, {
          mode: mode,
          port: port,
          pathname: pathname,
          search: iFrameLocation.search,
          hash: iFrameLocation.hash
        });
        this._pathWidget.value =
          pathname.charAt(0) === '/' ? pathname.substring(1) : pathname;
      }
    }
  }

  private _evtLoadPortsTimer(): void {
    const requestUrl = URLExt.join(
      this._serverSettings.baseUrl,
      'jupyterlab-local-browser',
      'open-ports'
    );

    ServerConnection.makeRequest(requestUrl, {}, this._serverSettings).then(
      response => {
        response.json().then((data: [string, string][]) => {
          const baseUrl = new URL(this._serverSettings.baseUrl);
          const basePort = baseUrl.port;
          const values = data
            .map(([port, label]: [string, string]) => {
              if (port !== basePort) {
                return [port, label];
              } else {
                return null;
              }
            })
            .filter(value => value !== null) as [string, string][];
          values.splice(0, 0, ['_placeholder', 'Select a Port']);
          this._portsWidget.values = values;
        });
      }
    );
  }

  private _serverSettings: ServerConnection.ISettings;
  private _loadPortsInterval = -1;
  private _statedb: IStateDB;
  private _modeWidget: SelectWidget;
  private _portsWidget: SelectWidget;
  private _pathWidget: PathWidget;
}

class SelectWidget extends ReactWidget {
  constructor(options: { onChange: () => void; value?: string }) {
    super();

    this._values = [];
    this._value = options.value ? options.value : '';
    this._onChange = options.onChange;
  }

  set values(value: [string, string][]) {
    this._values = value;
    this.update();
  }

  get value(): string {
    return this._value;
  }

  set value(value: string) {
    this._value = value;
    this.update();
  }

  onChange(evt: React.ChangeEvent<HTMLSelectElement>) {
    this._value = evt.target.value;
    this._onChange();
    this.update();
  }

  render(): JSX.Element {
    const values = [];
    for (const [value, label] of this._values) {
      values.push(
        <option value={value} selected={value === this._value}>
          {label}
        </option>
      );
    }
    return <HTMLSelect onChange={evt => this.onChange(evt)}>{values}</HTMLSelect>;
  }

  private _values: [string, string][];
  private _value: string;
  private _onChange: () => void;
}

class PathWidget extends ReactWidget {
  constructor(options: { onChange: () => void; value?: string }) {
    super();

    this._onChange = options.onChange;
    this._value = options.value ? options.value : '';
  }

  get value(): string {
    return this._value;
  }

  set value(value: string) {
    this._value = value;
    this.update();
  }

  onChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this._value = evt.target.value;
    this._onChange();
    this.update();
  }

  render(): JSX.Element {
    return (
      <input
        type="text"
        value={this._value}
        onChange={evt => this.onChange(evt)}
        className="jp-Default"
      ></input>
    );
  }

  private _value: string;
  private _onChange: () => void;
}

export namespace LocalBrowserWidget {
  export interface IOptions {
    uuid: string;
    statedb: IStateDB;
  }
}
