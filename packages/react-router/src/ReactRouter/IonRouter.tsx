import {
  LocationHistory,
  NavManager,
  RouteAction,
  RouteInfo,
  RouteManagerContext,
  RouteManagerContextState,
  RouterDirection,
  generateId
} from '@ionic/react';
import { Action as HistoryAction, Location as HistoryLocation } from 'history';
import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';

import StackManager from './StackManager';

export interface LocationState {
  // direction?: RouterDirection;
  // action?: RouteAction;
}

interface IonRouteProps extends RouteComponentProps<{}, {}, LocationState> {
  registerHistoryListener: (cb: (location: HistoryLocation<any>, action: HistoryAction) => void) => void;
}

interface IonRouteState {
  location?: HistoryLocation<LocationState>;
  action?: RouteAction;
}

class IonRouterInner extends React.Component<IonRouteProps, IonRouteState> {
  currentPathname: string | undefined;
  currentTab?: string;
  exitViewFromOtherOutletHandlers: ((pathname: string) => void)[] = [];
  incomingRouteParams?: Partial<RouteInfo>;
  locationHistory = new LocationHistory();
  routeChangedHandlers: ((routeInfo: RouteInfo) => void)[] = [];
  routeInfo: RouteInfo;
  routeMangerContextState: RouteManagerContextState = {
    exitViewFromOtherOutlet: this.exitViewFromOtherOutlet.bind(this),
    onRouteChange: this.registerRouteChangeHandler.bind(this),
    onExitViewFromOtherOutlet: this.registerExitViewFromOtherOutletHandler.bind(this)
  };
  pendingRouteChange?: RouteInfo;

  constructor(props: IonRouteProps) {
    super(props);

    this.routeInfo = {
      id: generateId('routeInfo'),
      pathname: this.props.location.pathname,
      search: this.props.location.search
    };

    this.locationHistory.add(this.routeInfo);

    this.handleChangeTab = this.handleChangeTab.bind(this);
    this.handleResetTab = this.handleResetTab.bind(this);
    this.handleNavigate = this.handleNavigate.bind(this);
    this.handleNavigateBack = this.handleNavigateBack.bind(this);
    this.props.registerHistoryListener(this.handleHistoryChange.bind(this));
    this.handleSetCurrentTab = this.handleSetCurrentTab.bind(this);

  }

  componentDidMount() {
    this.routeInfo.tab = this.currentTab;
  }

  shouldComponentUpdate() {
    return false;
  }

  exitViewFromOtherOutlet(pathname: string) {
    this.exitViewFromOtherOutletHandlers.forEach(cb => {
      cb(pathname);
    });
  }

  handleChangeTab(tab: string, path: string, routeOptions?: any) {
    const routeInfo = this.locationHistory.getCurrentRouteInfoForTab(tab);
    if (routeInfo) {
      this.incomingRouteParams = { ...routeInfo, routeAction: 'push', routeDirection: 'none' };
      this.props.history.push(routeInfo.pathname + (routeInfo.search || ''));
    } else {
      this.handleNavigate(path, 'push', 'none', routeOptions, tab);
    }
  }

  handleHistoryChange(location: HistoryLocation<LocationState>, action: HistoryAction) {

    let leavingLocationInfo: RouteInfo;
    if (this.incomingRouteParams) {
      if (this.incomingRouteParams.routeAction === 'replace') {
        leavingLocationInfo = this.locationHistory.previous();
      } else {
        leavingLocationInfo = this.locationHistory.current();
      }
    } else if (action === 'REPLACE') {
      leavingLocationInfo = this.locationHistory.previous();
    } else {
      leavingLocationInfo = this.locationHistory.current();
    }

    const leavingUrl = leavingLocationInfo.pathname + leavingLocationInfo.search;

    if (leavingUrl !== location.pathname) {

      if (!this.incomingRouteParams) {
        this.incomingRouteParams = {
          routeAction: action === 'REPLACE' ? 'replace' : 'push',
          routeDirection: action === 'REPLACE' ? 'none' : 'forward',
          tab: this.currentTab
        };
      }

      if (this.incomingRouteParams?.id) {
        this.routeInfo = {
          ...this.incomingRouteParams as RouteInfo,
          lastPathname: leavingLocationInfo.pathname
        };
        this.locationHistory.add(this.routeInfo);
      } else {
        const isPushed = (this.incomingRouteParams.routeAction === 'push' && this.incomingRouteParams.routeDirection === 'forward');
        this.routeInfo = {
          id: generateId('routeInfo'),
          ...this.incomingRouteParams,
          lastPathname: leavingLocationInfo.pathname,
          pathname: location.pathname,
          search: location.search,
          params: this.props.match.params
        };
        if (isPushed) {
          this.routeInfo.tab = leavingLocationInfo.tab;
          this.routeInfo.pushedByRoute = leavingLocationInfo.pathname;
        } else if (this.routeInfo.routeAction === 'pop') {
          const r = this.locationHistory.findLastLocation(this.routeInfo);
          this.routeInfo.pushedByRoute = r?.pushedByRoute;
        } else if (this.routeInfo.routeAction === 'push' && this.routeInfo.tab !== leavingLocationInfo.tab) {
          // If we are switching tabs grab the last route info for the tab and use its pushedByRoute
          const lastRoute = this.locationHistory.getCurrentRouteInfoForTab(this.routeInfo.tab);
          this.routeInfo.pushedByRoute = lastRoute?.pushedByRoute;
        }

        this.locationHistory.add(this.routeInfo);
      }
    }

    this.forceUpdate();

    if (this.routeChangedHandlers.length === 0) {
      this.pendingRouteChange = this.routeInfo;
    }
    this.routeChangedHandlers.forEach(h => h(this.routeInfo));

    this.currentPathname = location.pathname;
    this.incomingRouteParams = undefined;

    // TODO: this state needed?
    this.setState({
      location
    });
  }

  handleNavigate(path: string, routeAction: RouteAction, routeDirection?: RouterDirection, routeOptions?: any, tab?: string) {
    this.incomingRouteParams = {
      routeAction,
      routeDirection,
      routeOptions,
      tab
    };

    if (routeAction === 'push') {
      this.props.history.push(path);
    } else {
      this.props.history.replace(path);
    }
  }

  handleNavigateBack(path: string | RouteInfo = '/') {
    const routeInfo = this.locationHistory.current();
    if (routeInfo && routeInfo.pushedByRoute) {
      const prevInfo = this.locationHistory.findLastLocation(routeInfo);
      if (prevInfo) {
        this.incomingRouteParams = { ...prevInfo, routeAction: 'pop', routeDirection: 'back' };
        this.props.history.replace(prevInfo.pathname + (prevInfo.search || ''));
      } else {
        this.handleNavigate(path as string, 'pop', 'back');
      }
    } else {
      this.handleNavigate(path as string, 'pop', 'back');
    }
  }

  handleResetTab(tab: string, originalHref: string, originalRouteOptions: any) {
    const routeInfo = this.locationHistory.getFirstRouteInfoForTab(tab);
    if (routeInfo) {
      const newRouteInfo = { ...routeInfo };
      newRouteInfo.pathname = originalHref;
      newRouteInfo.routeOptions = originalRouteOptions;
      this.incomingRouteParams = { ...newRouteInfo, routeAction: 'pop', routeDirection: 'back' };
      this.props.history.push(newRouteInfo.pathname + (newRouteInfo.search || ''));
    }
  }

  handleSetCurrentTab(tab: string) {
    this.currentTab = tab;
    const ri = { ...this.locationHistory.current() };
    if (ri.tab !== tab) {
      ri.tab = tab;
      this.locationHistory.update(ri);
    }
  }

  registerExitViewFromOtherOutletHandler(cb: (pathname: string) => void) {
    this.exitViewFromOtherOutletHandlers.push(cb);
    return () => {
      this.exitViewFromOtherOutletHandlers = this.exitViewFromOtherOutletHandlers.filter(x => x !== cb);
    };
  }

  registerRouteChangeHandler(cb: (routeInfo: RouteInfo) => void) {
    this.routeChangedHandlers.push(cb);
    return () => {
      this.routeChangedHandlers = this.routeChangedHandlers.filter(x => x !== cb);
    };
  }

  render() {
    return (
      <RouteManagerContext.Provider
        value={this.routeMangerContextState}
      >
        <NavManager
          stackManager={StackManager}
          routeInfo={this.routeInfo}
          onNavigateBack={this.handleNavigateBack}
          onNavigate={this.handleNavigate}
          onSetCurrentTab={this.handleSetCurrentTab}
          onChangeTab={this.handleChangeTab}
          onResetTab={this.handleResetTab}
        >
          {this.props.children}
        </NavManager>
      </RouteManagerContext.Provider>
    );
  }
}

export const IonRouter = withRouter(IonRouterInner);
IonRouter.displayName = 'IonRouter';