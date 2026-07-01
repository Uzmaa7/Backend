import { esClient, TRAIN_INDEX, STATION_INDEX } from '../config/elasticsearch.js'; 
import logger from '../config/logger.js';

// ═══════════════════════════════════════════════════
//  INDEX OPERATIONS (called by Kafka consumer)
// ═══════════════════════════════════════════════════

/**
 * When admin creates a station, index it for autocomplete.
 * Event shape: { eventType, data: { id, name, code, city, state }, timestamp }
 */
const indexStation = async (event) => {
     const station = event.data;
     if (!station) return;

     try {
          await esClient.index({
               index: STATION_INDEX,
               id: station.id,
               document: {
                    stationId: station.id,
                    name: station.name,
                    code: station.code,
                    city: station.city,
                    suggest: {
                         input: [station.name, station.code, station.city].filter(Boolean),
                         weight: 10,
                    },
               },
               refresh: true,
          });
          logger.info(`Indexed station ${station.name} (${station.code})`);
     } catch (err) {
          logger.error(`Failed to index station: ${err.message}`);
     }
};

