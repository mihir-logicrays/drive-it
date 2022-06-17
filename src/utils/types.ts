import { JwtPayload } from 'jsonwebtoken';

export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  uuid: any;
  geography: any;
  Datetime: any;
};

export type Mutation = {
  __typename?: 'Mutation';
  CancelSeatAction?: Maybe<CancelSeatActionOutput>;
  DriverPingLocationAction?: Maybe<DriverPingLocationActionOutput>;
  ReserveSeatAction?: Maybe<ReserveSeatActionOutput>;
  BoardAction?: Maybe<BoardActionOutput>;
  RouteDepartAction?: Maybe<RouteDepartActionOutput>;
  RouteDoneAction?: Maybe<RouteDoneActionOutput>;
  StopDoneAction?: Maybe<StopDoneActionOutput>;
  UpdateProfileAction?: Maybe<UpdateProfileActionOutput>;
  CreateCorporateAction?: Maybe<CreateCorporateActionOutput>;
};

export type MutationRouteDepartActionArgs = {
  id: Scalars['uuid'];
};

export type MutationStopDoneActionArgs = {
  id: Scalars['uuid'];
  done?: Maybe<Scalars['Boolean']>;
};

export type RouteDepartActionOutput = {
  __typename?: 'RouteDepartMutationOutput';
  departed: Scalars['Boolean'];
  driver_id: Scalars['String'];
  id: Scalars['uuid'];
};

export type RouteDepartMutationOutput = {
  update_routes_by_pk: RouteDepartActionOutput;
};

export type RouteDepartMutationVariables = {
  id: Scalars['uuid'];
  driver_id: Scalars['String'];
};

export type StopDoneMutationOutput = {
  update_stops_by_pk: StopDoneActionOutput;
};

export type StopDoneActionOutput = {
  __typename?: 'StopDoneActionOutput';
  done?: Maybe<Scalars['Boolean']>;
  id: Scalars['uuid'];
};

export type StopDoneActionVariables = {
  id: Scalars['uuid'];
  done: Scalars['Boolean'];
};

export type RouteDoneActionOutput = {
  __typename?: 'RouteDoneActionOutput';
  done: Scalars['Boolean'];
  id: Scalars['uuid'];
};

export type MutationRouteDoneActionArgs = {
  id: Scalars['uuid'];
};

export type RouteDoneActionVariables = {
  id: Scalars['uuid'];
};

export type RouteDoneMutationOutput = {
  update_routes_by_pk: {
    id: Scalars['uuid'];
    done: Scalars['Boolean'];
  };
  update_stops: {
    affected_rows: Scalars['Int'];
  };
};

export type CreateCorporateActionOutput = {
  id: Scalars['uuid'];
};

export type CreateCorporateMutationOutput = {
  id: Scalars['uuid'];
};

export type ReserveSeatActionOutput = {
  __typename?: 'ReserveSeatActionOutput';
  route_id: Scalars['uuid'];
  user_id: Scalars['String'];
};

export type BoardActionOutput = {
  __typename?: 'BoardActionOutput';
  route_id: Scalars['uuid'];
  user_id: Scalars['String'];
  boarded: Scalars['Boolean'];
};

export type ReserveSeatMutationOutput = {
  insert_route_stop_user_one: {
    route_id: string;
    user_id: string;
  };
};

export type BoardMutationOutput = {
  update_route_stop_user_by_pk: {
    route_id: string;
    user_id: string;
    boarded: boolean;
  };
};

export type ChallengeQueryOutput = {
  route_stop_user_by_pk: {
    route: {
      car: {
        id: string;
        qr: string;
      };
    };
  };
};

export type CreateCorporateActionArgs = {
  badge: Scalars['String'];
  phone: Scalars['String'];
  company: Scalars['String'];
};

export type MutationReserveSeatActionArgs = {
  user_id: Scalars['String'];
  route_id: Scalars['uuid'];
  desired_dropoff: Scalars['geography'];
  desired_dropoff_address: Scalars['String'];
  desired_pickup: Scalars['geography'];
  desired_pickup_address: Scalars['String'];
};

export type MutationBoardActionArgs = {
  user_id: Scalars['String'];
  route_id: Scalars['uuid'];
};

export type ReserveSeatActionVariables = {
  user_id: Scalars['String'];
  route_id: Scalars['uuid'];
  desired_dropoff: Scalars['geography'];
  desired_dropoff_address: Scalars['String'];
  desired_pickup: Scalars['geography'];
  desired_pickup_address: Scalars['String'];
};

export type BoardActionVariables = {
  user_id: Scalars['String'];
  route_id: Scalars['uuid'];
};

export type ChallengeQueryVariables = {
  user_id: Scalars['String'];
  route_id: Scalars['uuid'];
};

export type MutationCancelSeatActionArgs = {
  route_id: Scalars['uuid'];
};

export type CancelSeatActionVariables = {
  route_id: string;
  user_id: string;
};

export type CancelSeatMutationOutput = {
  delete_route_stop_user: {
    affected_rows: number;
  };
};

export type CancelSeatActionOutput = {
  affected_rows: number;
};

export type DriverPingLocationActionOutput = {
  __typename?: 'DriverPingLocationActionOutput';
  current_location?: Maybe<Scalars['geography']>;
  id: Scalars['uuid'];
};

export type MutationDriverPingLocationActionArgs = {
  current_location: Scalars['geography'];
  route_id?: Maybe<Scalars['uuid']>;
};

export type MutationCreateCorporateArgs = {
  name: Scalars['String'];
  badge: Scalars['String'];
  phone: Scalars['String'];
  company: Scalars['String'];
};

export type DriverPingLocationActionVariables = {
  route_id: Scalars['uuid'];
  current_location: Scalars['geography'];
};

export type DriverPingLocationMutationOutput = {
  update_routes_by_pk: {
    current_location: Scalars['geography'];
    id: Scalars['uuid'];
  };
};

export interface Auth0Token extends JwtPayload {
  'https://hasura.io/jwt/claims': {
    'x-hasura-default-role': string;
    'x-hasura-allowed-roles': [string];
    'x-hasura-user-id': string;
    'x-hasura-phone_number': string;
  };
  nickname: string;
  name: string;
  picture: string;
  updated_at: string;
  phone_number: string;
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
}

export type HasuraError = {
  message: string;
};

export type UpdateProfileCardDetails = {
  brand: Scalars['String'];
  complete: Scalars['Boolean'];
  expiryMonth: Scalars['Int'];
  expiryYear: Scalars['Int'];
  last4: Scalars['String'];
  number: Scalars['String'];
};

export type MutationUpdateProfileActionArgs = {
  id: Scalars['String'];
  name?: Scalars['String'];
  fcm_token?: Scalars['String'];
  card?: UpdateProfileCardDetails;
};

export type UpdateProfileVariables = {
  id: Scalars['String'];
  name?: Scalars['String'];
  fcm_token?: Scalars['String'];
  card?: UpdateProfileCardDetails;
};

export type UpdateProfileActionOutput = {
  __typename?: 'UpdateProfileActionOutput';
  id: Scalars['String'];
};

export type StopQueryOutput = {
  id: Scalars['uuid'];
};

export type StopQueryVariables = {
  __typename?: 'StopQueryOutput';
  stops: Scalars['uuid'];
};

export type PushNotificationVariables = {
  id: Scalars['uuid'];
};

export type PushnotificationOutput = {
  id: Scalars['uuid'];
};

export type GetPathsVariables = {
  is_dropoff: Scalars['Boolean'];
  routeId: Scalars['uuid'];
};

export type GetRouteVariables = {
  times: Scalars['Datetime'];
};

export type GetRouteQueryOutput = {
  routes: Scalars['uuid'];
};

export type GetPathsQueryOutput = {
  paths: [
    {
      id: Scalars['uuid'];
      stops: Scalars['String'];
      route_by_id: {
        route_stop_users: Scalars['uuid'];
      };
    }
  ];
  stops: [
    {
      id: Scalars['uuid'];
      location: Scalars['String'];
    }
  ];
};

export type updateRouteVariables = {
  id: Scalars['uuid'];
  final_highest_path: Scalars['String'];
};
export type updateRouteOutput = {
  id: Scalars['uuid'];
};

export type isDropOffMutationVariables = {
  route_id: Scalars['uuid'];
  user_id: Scalars['String'];
  dropoff_stop_id: Scalars['uuid'];
};

export type isDropOffMutationOutput = {
  dropoff_stop_id: Scalars['uuid'];
};

export type isPickupMutationVariables = {
  route_id: Scalars['uuid'];
  user_id: Scalars['String'];
  pickup_stop_id: Scalars['uuid'];
};

export type isPickupMutationOutput = {
  pickup_stop_id: Scalars['uuid'];
};
