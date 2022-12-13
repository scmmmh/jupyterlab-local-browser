import {
  MainAreaWidget,
  IFrame,
  ReactiveToolbar,
  ReactWidget
} from '@jupyterlab/apputils';
import { IStateDB } from '@jupyterlab/statedb';
import { ServerConnection } from '@jupyterlab/services';
import { URLExt } from '@jupyterlab/coreutils';
import { Message } from '@lumino/messaging';
import React from 'react';

/**
 * A widget providing a browser for local servers.
 */
export class LocalBrowserWidget extends MainAreaWidget<IFrame> {
  constructor(options: LocalBrowserWidget.IOptions) {
    super({
      content: new IFrame({
        sandbox: ['allow-same-origin', 'allow-scripts']
      }),
      toolbar: new ReactiveToolbar()
    });
    this.id = options.uuid;
    this.title.label = 'Local Browser';
    this.title.closable = true;
    this.content.addClass('lb-localBrowser');

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
      value: ''
    });
    this.toolbar.addItem('path', this._pathWidget);
    const reloadButton = new ReloadWidget({
      onClick: () => {
        this.toolbarChanged();
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
        this._portsWidget.value = data.port;
        this._pathWidget.value =
          data.pathname.charAt(0) === '/'
            ? data.pathname.substring(1)
            : data.pathname;
        const url =
          '/' +
          data.mode +
          '/' +
          data.port +
          data.pathname +
          data.search +
          data.hash;
        this.content.url = url;
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
        '/proxy/' + this._portsWidget.value + '/' + this._pathWidget.value;
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
        let pathname = iFrameLocation.pathname.substring(1);
        const mode = pathname.substring(0, pathname.indexOf('/'));
        pathname = pathname.substring(pathname.indexOf('/') + 1);
        const port = pathname.substring(0, pathname.indexOf('/'));
        pathname = pathname.substring(pathname.indexOf('/'));
        this._statedb.save(this.id, {
          mode: mode,
          port: port,
          pathname: pathname,
          search: iFrameLocation.search,
          hash: iFrameLocation.hash
        });
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
    return <select onChange={evt => this.onChange(evt)}>{values}</select>;
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
      ></input>
    );
  }

  private _value: string;
  private _onChange: () => void;
}

class ReloadWidget extends ReactWidget {
  constructor(options: { onClick: () => void }) {
    super();

    this._onClick = options.onClick;
  }

  onClick() {
    this._onClick();
  }

  render(): JSX.Element {
    return (
      <button
        aria-label="Reload"
        onClick={evt => {
          this._onClick();
        }}
      >
        <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M2 12C2 16.97 6.03 21 11 21C13.39 21 15.68 20.06 17.4 18.4L15.9 16.9C14.63 18.25 12.86 19 11 19C4.76 19 1.64 11.46 6.05 7.05C10.46 2.64 18 5.77 18 12H15L19 16H19.1L23 12H20C20 7.03 15.97 3 11 3C6.03 3 2 7.03 2 12Z"
          />
        </svg>
      </button>
    );
  }

  private _onClick: () => void;
}

export namespace LocalBrowserWidget {
  export interface IOptions {
    uuid: string;
    statedb: IStateDB;
  }
}
