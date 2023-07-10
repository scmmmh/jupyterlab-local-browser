import json
import tornado
import os

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from psutil import net_connections
from tornado.web import StaticFileHandler

from .config import JupyterlabLocalBrowser


class OpenPortsHandler(APIHandler):

    def initialize(self, config: JupyterlabLocalBrowser):
        self._config = config
        self._config.hidden = [int(port) for port in self._config.hidden]
        self._config.persistent = [int(port) for port in self._config.persistent]
        self._config.labels = dict([(int(port), label) for (port, label) in self._config.labels.items()])


    @tornado.web.authenticated
    def get(self):
        ports = set()
        ports.update(self._config.persistent)
        ports.update([
            conn.laddr.port
            for conn in net_connections(kind='tcp')
            if (conn.laddr.ip == '127.0.0.1' or conn.laddr.ip == '0.0.0.0') and conn.status == 'LISTEN'
                and conn.laddr.port not in self._config.hidden
        ])
        ports = list(ports)
        ports.sort()
        ports = [(str(port), self._config.labels[port] if port in self._config.labels else str(port)) for port in ports]
        self.finish(json.dumps(ports))


def setup_handlers(web_app, config):
    host_pattern = '.*$'
    base_url = web_app.settings['base_url']
    handlers = []

    # Setup the dynamic route handlers
    handlers.append(
        (url_path_join(base_url, 'jupyterlab-local-browser', 'open-ports'), OpenPortsHandler, {'config': config})
    )

    # Setup the static path handler
    doc_url = url_path_join(base_url, 'jupyterlab-local-browser', 'public')
    doc_dir = os.getenv(
        'JUPYTERLAB_LOCAL_BROWSER_STATIC_DIR',
        os.path.join(os.path.dirname(__file__), 'public'),
    )
    handlers.append(
        ('{}/(.*)'.format(doc_url), StaticFileHandler, {'path': doc_dir})
    )

    web_app.add_handlers(host_pattern, handlers)
