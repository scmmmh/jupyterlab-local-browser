from ._version import __version__
from .handlers import setup_handlers
from .config import JupyterlabLocalBrowser as JupyterlabLocalBrowserConfig


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "local_browser"
    }]


def _jupyter_server_extension_points():
    """Specify which module contains the server extension."""
    return [{'module': 'jupyterlab_local_browser'}]


def _load_jupyter_server_extension(server_app):
    """Setup the server extension."""
    setup_handlers(server_app.web_app, JupyterlabLocalBrowserConfig(parent=server_app))
