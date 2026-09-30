# Exits (and so notifies Lane C) when a DeepSeek run log shows a provider credit/rate-limit ERROR line (not doc text).
R="${LANE_C_HOME:-D:/ATLAS-lane-c}/runs"
P='(APICallError|ProviderError|statusCode"?:? ?(402|429)|^Error:.*(402|429|insufficient|quota|credit|balance|rate limit))'
while :; do
  hit=$(grep -l -E "$P" $R/*-ds-*.log 2>/dev/null | head -1)
  [ -n "$hit" ] && { echo "DEPLETED? $hit"; grep -E "$P" "$hit" | tail -3; exit 0; }
  sleep 60
done
