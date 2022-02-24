/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*
 * Modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

import { IUiSettingsClient as IUiSettingsClientPublic } from 'src/core/public';
// eslint-disable-next-line @osd/eslint/no-restricted-paths
import { IUiSettingsClient as IUiSettingsClientServer } from 'src/core/server';
import { BucketAggType } from './buckets/bucket_agg_type';
import { MetricAggType } from './metrics/metric_agg_type';
import { AggTypesDependencies } from './agg_types';

export type AggTypesRegistrySetup = ReturnType<AggTypesRegistry['setup']>;
/**
 * AggsCommonStart returns the _unitialized_ agg type providers, but in our
 * real start contract we will need to return the initialized versions.
 * So we need to provide the correct typings so they can be overwritten
 * on client/server.
 *
 * @internal
 */
export interface AggTypesRegistryStart {
  get: (id: string) => BucketAggType<any> | MetricAggType<any>;
  getAll: () => { buckets: Array<BucketAggType<any>>; metrics: Array<MetricAggType<any>> };
}

export interface AggTypesRegistryStartDependencies {
  uiSettings: IUiSettingsClientPublic | IUiSettingsClientServer;
}

export class AggTypesRegistry {
  private readonly bucketAggs = new Map();
  private readonly metricAggs = new Map();

  setup = () => {
    return {
      registerBucket: <
        N extends string,
        T extends (deps: AggTypesDependencies) => BucketAggType<any>
      >(
        name: N,
        type: T
      ): void => {
        if (this.bucketAggs.get(name) || this.metricAggs.get(name)) {
          throw new Error(`Agg has already been registered with name: ${name}`);
        }
        this.bucketAggs.set(name, type);
      },
      registerMetric: <
        N extends string,
        T extends (deps: AggTypesDependencies) => MetricAggType<any>
      >(
        name: N,
        type: T
      ): void => {
        if (this.bucketAggs.get(name) || this.metricAggs.get(name)) {
          throw new Error(`Agg has already been registered with name: ${name}`);
        }
        this.metricAggs.set(name, type);
      },
    };
  };

  start = ({ uiSettings }: AggTypesRegistryStartDependencies) => {
    const disabledBucketAgg = uiSettings.get('visualize:disableBucketAgg');

    for (const k of this.bucketAggs.keys()) {
      if (disabledBucketAgg.includes(k)) this.bucketAggs.delete(k);
    }

    return {
      get: (name: string) => {
        return this.bucketAggs.get(name) || this.metricAggs.get(name);
      },
      getAll: () => {
        return {
          buckets: Array.from(this.bucketAggs.values()),
          metrics: Array.from(this.metricAggs.values()),
        };
      },
    };
  };
}
